import { describe, it, expect } from 'vitest';
import {
  // Semver utilities
  parseSemver,
  compareVersions,
  isPreRelease,
  getUpdateType,

  // Conventional commits
  parseConventionalCommit,
  createConventionalCommit,
  COMMIT_TYPES,
  suggestCommitType,

  // Git utilities
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown
} from '../utils';

/**
 * Integration verification test for README-documented semver and git utilities
 *
 * This test verifies that all utilities work correctly in real-world scenarios
 * and that the examples from the README actually work as documented.
 */

describe('Semver and Git Utilities Integration Verification', () => {

  describe('Real-world workflow simulation', () => {

    it('should handle complete version release workflow', () => {
      // Scenario: Preparing a new release from git history

      // Step 1: Parse current version
      const currentVersion = parseSemver('1.2.3');
      expect(currentVersion).toBeTruthy();
      expect(currentVersion!.major).toBe(1);
      expect(currentVersion!.minor).toBe(2);
      expect(currentVersion!.patch).toBe(3);

      // Step 2: Determine next version based on conventional commits
      const gitLog = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

feat(auth): add OAuth support

Support for Google and GitHub authentication

commit def456
Author: Jane Smith <jane@example.com>
Date: Mon Jan 1 11:00:00 2023

fix: resolve login timeout issue

commit ghi789
Author: Bob Johnson <bob@example.com>
Date: Mon Jan 1 10:00:00 2023

docs: update API documentation`;

      const commits = parseGitLog(gitLog);
      expect(commits).toHaveLength(3);

      // Group commits by type
      const groups = groupCommitsByType(commits);
      expect(groups).toHaveLength(3); // feat, fix, docs

      // Determine update type - should be minor due to feat commit
      const nextVersion = '1.3.0'; // Minor bump for new feature
      const updateType = getUpdateType('1.2.3', nextVersion);
      expect(updateType).toBe('minor');

      // Step 3: Generate changelog
      const changelog = generateChangelogMarkdown(nextVersion, new Date('2023-01-01'), groups, {
        includeHashes: true,
        repoUrl: 'https://github.com/user/repo'
      });

      expect(changelog).toContain('## [1.3.0] - 2023-01-01');
      expect(changelog).toContain('### ✨ Features');
      expect(changelog).toContain('**auth:** add OAuth support');
      expect(changelog).toContain('### 🐛 Bug Fixes');
      expect(changelog).toContain('resolve login timeout issue');
      expect(changelog).toContain('### 📚 Documentation');
      expect(changelog).toContain('update API documentation');
    });

    it('should handle merge conflict resolution workflow', () => {
      // Scenario: Resolving conflicts during a feature merge

      const conflictFile = `
import { Component } from 'react';

class AuthComponent extends Component {
<<<<<<< HEAD
  constructor(props) {
    super(props);
    this.state = { user: null, loading: false };
  }
=======
  constructor(props) {
    super(props);
    this.state = { user: null, isAuthenticated: false };
  }
>>>>>>> feature-auth-improvements

  render() {
    return <div>Auth Component</div>;
  }
}
`;

      // Step 1: Detect conflicts
      const conflicts = detectConflicts(conflictFile, 'src/AuthComponent.js');
      expect(conflicts).toBeTruthy();
      expect(conflicts!.conflictMarkers).toHaveLength(1);

      const marker = conflicts!.conflictMarkers[0];
      expect(marker.currentContent).toContain('loading: false');
      expect(marker.incomingContent).toContain('isAuthenticated: false');

      // Step 2: Get resolution suggestions
      const suggestions = suggestConflictResolution(marker);
      expect(suggestions.length).toBeGreaterThan(0);

      const keepBothSuggestion = suggestions.find(s => s.type === 'keep-both');
      expect(keepBothSuggestion).toBeTruthy();
      expect(keepBothSuggestion!.resolvedContent).toContain('loading: false');
      expect(keepBothSuggestion!.resolvedContent).toContain('isAuthenticated: false');

      // Step 3: Generate conflict report
      const report = formatConflictReport([conflicts!]);
      expect(report).toContain('Found 1 file(s) with conflicts');
      expect(report).toContain('src/AuthComponent.js');
      expect(report).toContain('Conflicts: 1');
    });

    it('should handle commit message generation workflow', () => {
      // Scenario: Developer making commits with proper conventional format

      // Step 1: Suggest commit type based on changed files
      const testFiles = ['src/auth.test.js', 'src/login.test.js'];
      const testCommitType = suggestCommitType(testFiles);
      expect(testCommitType).toBe('test');

      const docsFiles = ['README.md', 'docs/api.md'];
      const docsCommitType = suggestCommitType(docsFiles);
      expect(docsCommitType).toBe('docs');

      const sourceFiles = ['src/api.js', 'src/utils.js'];
      const sourceCommitType = suggestCommitType(sourceFiles);
      expect(sourceCommitType).toBe('feat');

      // Step 2: Create conventional commit messages
      const testCommit = createConventionalCommit('test', 'add authentication tests', {
        scope: 'auth',
        body: 'Covers OAuth login and logout scenarios'
      });
      expect(testCommit).toBe('test(auth): add authentication tests\n\nCovers OAuth login and logout scenarios');

      const breakingCommit = createConventionalCommit('refactor', 'change API interface', {
        breaking: true,
        body: 'BREAKING CHANGE: API endpoints now use v2 format'
      });
      expect(breakingCommit).toBe('refactor!: change API interface\n\nBREAKING CHANGE: API endpoints now use v2 format');

      // Step 3: Parse commit messages
      const parsedCommit = parseConventionalCommit(testCommit);
      expect(parsedCommit).toEqual({
        type: 'test',
        scope: 'auth',
        description: 'add authentication tests',
        body: 'Covers OAuth login and logout scenarios',
        breaking: false
      });
    });

    it('should handle prerelease version workflow', () => {
      // Scenario: Managing alpha/beta releases

      const versions = [
        '1.0.0',
        '1.1.0-alpha',
        '1.1.0-alpha.1',
        '1.1.0-beta',
        '1.1.0-rc.1',
        '1.1.0',
        '1.1.1'
      ];

      // Verify all versions parse correctly
      versions.forEach(version => {
        const parsed = parseSemver(version);
        expect(parsed).toBeTruthy();
        expect(parsed!.raw).toBe(version);
      });

      // Verify prerelease detection
      expect(isPreRelease('1.0.0')).toBe(false);
      expect(isPreRelease('1.1.0-alpha')).toBe(true);
      expect(isPreRelease('1.1.0-alpha.1')).toBe(true);
      expect(isPreRelease('1.1.0-beta')).toBe(true);
      expect(isPreRelease('1.1.0-rc.1')).toBe(true);
      expect(isPreRelease('1.1.0')).toBe(false);

      // Verify version ordering
      for (let i = 0; i < versions.length - 1; i++) {
        expect(compareVersions(versions[i], versions[i + 1])).toBe(-1);
      }

      // Verify update type detection
      expect(getUpdateType('1.0.0', '1.1.0-alpha')).toBe('minor');
      expect(getUpdateType('1.1.0-alpha', '1.1.0-alpha.1')).toBe('prerelease');
      expect(getUpdateType('1.1.0-alpha.1', '1.1.0-beta')).toBe('prerelease');
      expect(getUpdateType('1.1.0-rc.1', '1.1.0')).toBe('prerelease');
      expect(getUpdateType('1.1.0', '1.1.1')).toBe('patch');
    });
  });

  describe('Error handling and edge cases', () => {

    it('should gracefully handle invalid inputs across all functions', () => {
      // Invalid version handling
      expect(parseSemver('invalid')).toBeNull();
      expect(parseSemver('')).toBeNull();
      expect(parseSemver(null as any)).toBeNull();

      expect(isPreRelease('invalid')).toBe(false);
      expect(compareVersions('invalid', '1.0.0')).toBe(-1);
      expect(getUpdateType('invalid', '1.0.0')).toBe('none');

      // Invalid commit message handling
      expect(parseConventionalCommit('not a conventional commit')).toBeNull();
      expect(parseConventionalCommit('')).toBeNull();

      // Invalid git log handling
      expect(parseGitLog('')).toEqual([]);
      expect(parseGitLog('not a git log')).toEqual([]);

      // Invalid conflict detection
      expect(detectConflicts('no conflicts here', 'file.js')).toBeNull();
      expect(detectConflicts('', 'file.js')).toBeNull();

      // Empty inputs for other functions
      expect(suggestCommitType([])).toBe('chore');
      expect(groupCommitsByType([])).toEqual([]);
      expect(formatConflictReport([])).toBe('No conflicts detected.');
    });

    it('should handle COMMIT_TYPES structure correctly', () => {
      // Verify all expected commit types exist
      const expectedTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

      expectedTypes.forEach(type => {
        expect(COMMIT_TYPES).toHaveProperty(type);
        const typeConfig = COMMIT_TYPES[type as keyof typeof COMMIT_TYPES];
        expect(typeConfig).toHaveProperty('title');
        expect(typeConfig).toHaveProperty('emoji');
        expect(typeConfig).toHaveProperty('description');
        expect(typeof typeConfig.title).toBe('string');
        expect(typeof typeConfig.emoji).toBe('string');
        expect(typeof typeConfig.description).toBe('string');
      });

      // Verify specific examples from README
      expect(COMMIT_TYPES.feat).toEqual({
        title: 'Features',
        emoji: '✨',
        description: 'New features'
      });
    });
  });

  describe('Performance and scalability', () => {

    it('should handle large datasets efficiently', () => {
      // Large git log simulation
      const largeGitLog = Array(100).fill(0).map((_, i) =>
        `commit ${i.toString().padStart(40, '0')}\nAuthor: Developer ${i} <dev${i}@example.com>\nDate: Mon Jan ${(i % 28) + 1} 12:00:00 2023\n\nfeat: feature ${i}\n\nImplements feature number ${i}`
      ).join('\n\n');

      const start = performance.now();
      const entries = parseGitLog(largeGitLog);
      const groups = groupCommitsByType(entries);
      const changelog = generateChangelogMarkdown('2.0.0', new Date(), groups);
      const end = performance.now();

      expect(entries).toHaveLength(100);
      expect(groups[0].commits).toHaveLength(100);
      expect(changelog).toContain('## [2.0.0]');
      expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle complex version comparisons efficiently', () => {
      const versions = [
        '0.0.1', '0.0.1-alpha', '0.0.1-alpha.1', '0.0.1-alpha.beta', '0.0.1-beta',
        '0.0.1-beta.2', '0.0.1-beta.11', '0.0.1-rc.1', '0.0.1', '0.1.0-alpha',
        '0.1.0', '0.2.0', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta',
        '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'
      ];

      const start = performance.now();

      // Verify all versions are in correct order
      for (let i = 0; i < versions.length - 1; i++) {
        for (let j = i + 1; j < versions.length; j++) {
          expect(compareVersions(versions[i], versions[j])).toBe(-1);
          expect(compareVersions(versions[j], versions[i])).toBe(1);
        }
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(2000); // Should complete in less than 2 seconds
    });
  });
});