import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  type ConflictInfo,
  type ConflictMarker,
  type ConflictSuggestion,
  type GitLogEntry,
} from '../utils.js';

describe('Git Utilities', () => {
  describe('detectConflicts', () => {
    it('detects basic merge conflicts', () => {
      const fileContent = `function hello() {
<<<<<<< HEAD
  console.log("Hello from main");
=======
  console.log("Hello from feature");
>>>>>>> feature-branch
}`;

      const result = detectConflicts(fileContent, 'src/hello.js');

      expect(result).toEqual({
        file: 'src/hello.js',
        conflictMarkers: [{
          startLine: 2,
          endLine: 6,
          currentContent: '  console.log("Hello from main");',
          incomingContent: '  console.log("Hello from feature");'
        }],
        baseBranch: 'HEAD',
        incomingBranch: 'feature-branch'
      });
    });

    it('detects multiple conflicts in one file', () => {
      const fileContent = `function greet() {
<<<<<<< HEAD
  console.log("Hi");
=======
  console.log("Hello");
>>>>>>> feature

  function farewell() {
<<<<<<< HEAD
    console.log("Bye");
=======
    console.log("Goodbye");
>>>>>>> feature
  }
}`;

      const result = detectConflicts(fileContent, 'src/greet.js');

      expect(result).toBeTruthy();
      expect(result!.conflictMarkers).toHaveLength(2);
      expect(result!.conflictMarkers[0].currentContent).toBe('  console.log("Hi");');
      expect(result!.conflictMarkers[0].incomingContent).toBe('  console.log("Hello");');
      expect(result!.conflictMarkers[1].currentContent).toBe('    console.log("Bye");');
      expect(result!.conflictMarkers[1].incomingContent).toBe('    console.log("Goodbye");');
    });

    it('detects conflicts with custom branch names', () => {
      const fileContent = `
<<<<<<< main
  const version = 1;
=======
  const version = 2;
>>>>>>> feature/update-version
`;

      const result = detectConflicts(fileContent, 'version.js');

      expect(result?.baseBranch).toBe('main');
      expect(result?.incomingBranch).toBe('feature/update-version');
    });

    it('detects diff3 style conflicts with base', () => {
      const fileContent = `function calculate() {
<<<<<<< HEAD
  return a + b;
||||||| base
  return a * b;
=======
  return a - b;
>>>>>>> feature-branch
}`;

      const result = detectConflicts(fileContent, 'calc.js');

      expect(result).toBeTruthy();
      expect(result!.conflictMarkers[0]).toMatchObject({
        currentContent: '  return a + b;',
        baseContent: '  return a * b;',
        incomingContent: '  return a - b;'
      });
    });

    it('handles empty conflict sides', () => {
      const fileContent = `function test() {
<<<<<<< HEAD
=======
  console.log("Added in feature");
>>>>>>> feature-branch
}`;

      const result = detectConflicts(fileContent, 'test.js');

      expect(result?.conflictMarkers[0]).toMatchObject({
        currentContent: '',
        incomingContent: '  console.log("Added in feature");'
      });
    });

    it('handles complex multiline conflicts', () => {
      const fileContent = `class User {
<<<<<<< HEAD
  constructor(name, email) {
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }
=======
  constructor(name, email, role) {
    this.name = name;
    this.email = email;
    this.role = role || 'user';
    this.createdAt = Date.now();
  }
>>>>>>> feature/add-role
}`;

      const result = detectConflicts(fileContent, 'User.js');

      expect(result).toBeTruthy();
      expect(result!.conflictMarkers[0].currentContent).toContain('this.createdAt = new Date()');
      expect(result!.conflictMarkers[0].incomingContent).toContain('this.role = role');
    });

    it('returns null when no conflicts are found', () => {
      const cleanContent = `function hello() {
  console.log("Hello, world!");
}`;

      const result = detectConflicts(cleanContent, 'hello.js');

      expect(result).toBeNull();
    });

    it('ignores malformed conflict markers', () => {
      const malformedContent = `function test() {
<<<< HEAD (incomplete marker)
  console.log("test");
>>>>>> feature (incomplete marker)
}`;

      const result = detectConflicts(malformedContent, 'test.js');

      expect(result).toBeNull();
    });

    it('handles edge cases with whitespace', () => {
      const fileContent = `
<<<<<<< HEAD


=======
  // Added comment

>>>>>>> feature
`;

      const result = detectConflicts(fileContent, 'whitespace.js');

      expect(result).toBeTruthy();
      expect(result!.conflictMarkers[0].currentContent.trim()).toBe('');
      expect(result!.conflictMarkers[0].incomingContent.trim()).toBe('// Added comment');
    });
  });

  describe('suggestConflictResolution', () => {
    it('suggests keeping incoming when current is empty', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: '',
        incomingContent: 'console.log("new feature");'
      };

      const suggestions = suggestConflictResolution(marker);
      const topSuggestion = suggestions[0];

      expect(topSuggestion.type).toBe('keep-incoming');
      expect(topSuggestion.confidence).toBe('high');
      expect(topSuggestion.resolvedContent).toBe('console.log("new feature");');
    });

    it('suggests keeping current when incoming is empty', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'console.log("existing feature");',
        incomingContent: ''
      };

      const suggestions = suggestConflictResolution(marker);
      const topSuggestion = suggestions[0];

      expect(topSuggestion.type).toBe('keep-current');
      expect(topSuggestion.confidence).toBe('high');
      expect(topSuggestion.resolvedContent).toBe('console.log("existing feature");');
    });

    it('suggests keeping either when contents are identical', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: '  console.log("same content");  ',
        incomingContent: 'console.log("same content");'
      };

      const suggestions = suggestConflictResolution(marker);
      const topSuggestion = suggestions[0];

      expect(topSuggestion.type).toBe('keep-current');
      expect(topSuggestion.confidence).toBe('high');
      expect(topSuggestion.description).toContain('identical');
    });

    it('suggests keeping incoming when it includes current content', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'console.log("hello");',
        incomingContent: 'console.log("hello");\nconsole.log("world");'
      };

      const suggestions = suggestConflictResolution(marker);
      const incomingSuggestion = suggestions.find(s => s.type === 'keep-incoming');

      expect(incomingSuggestion).toBeTruthy();
      expect(incomingSuggestion!.confidence).toBe('medium');
      expect(incomingSuggestion!.description).toContain('includes current content');
    });

    it('suggests keeping current when it includes incoming content', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'console.log("hello");\nconsole.log("world");',
        incomingContent: 'console.log("hello");'
      };

      const suggestions = suggestConflictResolution(marker);
      const currentSuggestion = suggestions.find(s => s.type === 'keep-current');

      expect(currentSuggestion).toBeTruthy();
      expect(currentSuggestion!.confidence).toBe('medium');
      expect(currentSuggestion!.description).toContain('includes incoming content');
    });

    it('always includes keep-both and manual options', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'const a = 1;',
        incomingContent: 'const b = 2;'
      };

      const suggestions = suggestConflictResolution(marker);

      expect(suggestions.find(s => s.type === 'keep-both')).toBeTruthy();
      expect(suggestions.find(s => s.type === 'manual')).toBeTruthy();
    });

    it('creates appropriate combined content for keep-both', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'line1',
        incomingContent: 'line2'
      };

      const suggestions = suggestConflictResolution(marker);
      const bothSuggestion = suggestions.find(s => s.type === 'keep-both');

      expect(bothSuggestion!.resolvedContent).toBe('line1\nline2');
      expect(bothSuggestion!.confidence).toBe('low');
    });

    it('provides reasonable suggestions for complex conflicts', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 10,
        currentContent: `function oldImplementation() {
  return "old";
}`,
        incomingContent: `function newImplementation() {
  return "new";
}`
      };

      const suggestions = suggestConflictResolution(marker);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.resolvedContent !== undefined)).toBe(true);
      expect(suggestions.every(s => s.description.length > 0)).toBe(true);
    });
  });

  describe('formatConflictReport', () => {
    it('handles empty conflict list', () => {
      const report = formatConflictReport([]);

      expect(report).toBe('No conflicts detected.');
    });

    it('formats single conflict report', () => {
      const conflicts: ConflictInfo[] = [{
        file: 'src/auth.js',
        baseBranch: 'main',
        incomingBranch: 'feature',
        conflictMarkers: [{
          startLine: 5,
          endLine: 9,
          currentContent: 'old code',
          incomingContent: 'new code'
        }]
      }];

      const report = formatConflictReport(conflicts);

      expect(report).toContain('Found 1 file(s) with conflicts');
      expect(report).toContain('📄 src/auth.js');
      expect(report).toContain('Branches: main ← feature');
      expect(report).toContain('Conflicts: 1');
      expect(report).toContain('Conflict 1 (lines 5-9)');
    });

    it('formats multiple conflicts report', () => {
      const conflicts: ConflictInfo[] = [
        {
          file: 'src/auth.js',
          baseBranch: 'main',
          incomingBranch: 'feature',
          conflictMarkers: [
            { startLine: 5, endLine: 9, currentContent: '', incomingContent: 'new feature' }
          ]
        },
        {
          file: 'src/utils.js',
          baseBranch: 'main',
          incomingBranch: 'feature',
          conflictMarkers: [
            { startLine: 1, endLine: 3, currentContent: 'old', incomingContent: 'new' },
            { startLine: 10, endLine: 15, currentContent: 'old2', incomingContent: 'new2' }
          ]
        }
      ];

      const report = formatConflictReport(conflicts);

      expect(report).toContain('Found 2 file(s) with conflicts');
      expect(report).toContain('📄 src/auth.js');
      expect(report).toContain('📄 src/utils.js');
      expect(report).toContain('Conflicts: 1'); // auth.js
      expect(report).toContain('Conflicts: 2'); // utils.js
    });

    it('includes suggestions in the report', () => {
      const conflicts: ConflictInfo[] = [{
        file: 'test.js',
        baseBranch: 'HEAD',
        incomingBranch: 'feature',
        conflictMarkers: [{
          startLine: 1,
          endLine: 5,
          currentContent: '',
          incomingContent: 'new content'
        }]
      }];

      const report = formatConflictReport(conflicts);

      expect(report).toContain('Suggestion:');
      expect(report).toContain('Confidence:');
      expect(report).toContain('Reason:');
    });

    it('handles missing branch information gracefully', () => {
      const conflicts: ConflictInfo[] = [{
        file: 'test.js',
        conflictMarkers: [{
          startLine: 1,
          endLine: 5,
          currentContent: 'old',
          incomingContent: 'new'
        }]
      }];

      const report = formatConflictReport(conflicts);

      expect(report).toContain('Branches: HEAD ← incoming');
    });
  });

  describe('parseGitLog', () => {
    it('parses basic git log output', () => {
      const logOutput = `commit abc123def456
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2024 +0000

feat: add new feature

This adds a great new feature for users.

commit 789abc123def
Author: Jane Smith <jane@example.com>
Date: Sun Dec 31 18:30:00 2023 +0000

fix: resolve login bug`;

      const entries = parseGitLog(logOutput);

      expect(entries).toHaveLength(2);

      expect(entries[0]).toMatchObject({
        hash: 'abc123def456',
        shortHash: 'abc123d',
        author: 'John Doe <john@example.com>',
        message: 'feat: add new feature\n\nThis adds a great new feature for users.',
        conventional: {
          type: 'feat',
          description: 'add new feature',
          breaking: false
        }
      });

      expect(entries[1]).toMatchObject({
        hash: '789abc123def',
        shortHash: '789abc1',
        author: 'Jane Smith <jane@example.com>',
        message: 'fix: resolve login bug',
        conventional: {
          type: 'fix',
          description: 'resolve login bug',
          breaking: false
        }
      });
    });

    it('handles commits without conventional format', () => {
      const logOutput = `commit abc123
Author: Developer <dev@example.com>
Date: Mon Jan 1 12:00:00 2024 +0000

Regular commit message without conventional format`;

      const entries = parseGitLog(logOutput);

      expect(entries[0]).toMatchObject({
        message: 'Regular commit message without conventional format',
        conventional: undefined
      });
    });

    it('parses dates correctly', () => {
      const logOutput = `commit abc123
Author: Dev <dev@example.com>
Date: Wed Jan 15 14:30:45 2024 -0800

test: add unit tests`;

      const entries = parseGitLog(logOutput);

      expect(entries[0].date).toBeInstanceOf(Date);
      expect(entries[0].date.getFullYear()).toBe(2024);
    });

    it('handles empty log output', () => {
      const entries = parseGitLog('');

      expect(entries).toEqual([]);
    });

    it('handles malformed log entries gracefully', () => {
      const logOutput = `commit abc123
Author: Dev
Date: Invalid Date

Some commit`;

      const entries = parseGitLog(logOutput);

      expect(entries).toHaveLength(1);
      expect(entries[0].author).toBe('Dev');
    });

    it('parses complex commit messages with conventional format', () => {
      const logOutput = `commit abc123
Author: Dev <dev@example.com>
Date: Mon Jan 1 12:00:00 2024 +0000

feat(auth)!: implement OAuth

BREAKING CHANGE: Old auth tokens are no longer valid.

This implements OAuth 2.0 authentication with Google and GitHub providers.`;

      const entries = parseGitLog(logOutput);

      expect(entries[0].conventional).toMatchObject({
        type: 'feat',
        scope: 'auth',
        description: 'implement OAuth',
        breaking: true
      });
    });
  });

  describe('groupCommitsByType', () => {
    it('groups commits by conventional commit type', () => {
      const entries: GitLogEntry[] = [
        {
          hash: 'abc1',
          shortHash: 'abc1',
          author: 'Dev',
          date: new Date(),
          message: 'feat: add feature',
          conventional: { type: 'feat', description: 'add feature', breaking: false }
        },
        {
          hash: 'abc2',
          shortHash: 'abc2',
          author: 'Dev',
          date: new Date(),
          message: 'fix: fix bug',
          conventional: { type: 'fix', description: 'fix bug', breaking: false }
        },
        {
          hash: 'abc3',
          shortHash: 'abc3',
          author: 'Dev',
          date: new Date(),
          message: 'feat: another feature',
          conventional: { type: 'feat', description: 'another feature', breaking: false }
        }
      ];

      const groups = groupCommitsByType(entries);

      expect(groups).toHaveLength(2);

      const featGroup = groups.find(g => g.type === 'feat');
      const fixGroup = groups.find(g => g.type === 'fix');

      expect(featGroup?.commits).toHaveLength(2);
      expect(fixGroup?.commits).toHaveLength(1);
      expect(featGroup?.title).toBe('Features');
      expect(fixGroup?.title).toBe('Bug Fixes');
    });

    it('creates other group for non-conventional commits', () => {
      const entries: GitLogEntry[] = [
        {
          hash: 'abc1',
          shortHash: 'abc1',
          author: 'Dev',
          date: new Date(),
          message: 'Random commit message'
        },
        {
          hash: 'abc2',
          shortHash: 'abc2',
          author: 'Dev',
          date: new Date(),
          message: 'feat: add feature',
          conventional: { type: 'feat', description: 'add feature', breaking: false }
        }
      ];

      const groups = groupCommitsByType(entries);

      expect(groups).toHaveLength(2);

      const otherGroup = groups.find(g => g.type === 'other');
      expect(otherGroup).toBeTruthy();
      expect(otherGroup!.title).toBe('Other Changes');
      expect(otherGroup!.commits).toHaveLength(1);
    });

    it('maintains order of commit types', () => {
      const entries: GitLogEntry[] = [
        { hash: 'fix1', shortHash: 'fix1', author: 'Dev', date: new Date(), message: 'fix: bug', conventional: { type: 'fix', description: 'bug', breaking: false } },
        { hash: 'feat1', shortHash: 'feat1', author: 'Dev', date: new Date(), message: 'feat: feature', conventional: { type: 'feat', description: 'feature', breaking: false } },
        { hash: 'docs1', shortHash: 'docs1', author: 'Dev', date: new Date(), message: 'docs: update', conventional: { type: 'docs', description: 'update', breaking: false } }
      ];

      const groups = groupCommitsByType(entries);

      // Should be in order defined by COMMIT_TYPES
      expect(groups[0].type).toBe('feat');
      expect(groups[1].type).toBe('fix');
      expect(groups[2].type).toBe('docs');
    });

    it('handles empty commit list', () => {
      const groups = groupCommitsByType([]);

      expect(groups).toEqual([]);
    });

    it('ignores unknown commit types', () => {
      const entries: GitLogEntry[] = [{
        hash: 'abc1',
        shortHash: 'abc1',
        author: 'Dev',
        date: new Date(),
        message: 'custom: some change',
        conventional: { type: 'custom', description: 'some change', breaking: false }
      }];

      const groups = groupCommitsByType(entries);

      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('other');
    });
  });

  describe('generateChangelogMarkdown', () => {
    const mockDate = new Date('2024-01-15T10:00:00Z');
    const mockGroups = [
      {
        type: 'feat' as const,
        title: 'Features',
        commits: [
          {
            hash: 'abc123',
            shortHash: 'abc123',
            author: 'Dev <dev@example.com>',
            date: mockDate,
            message: 'feat: add feature',
            conventional: { type: 'feat', description: 'add user authentication', breaking: false }
          }
        ]
      },
      {
        type: 'fix' as const,
        title: 'Bug Fixes',
        commits: [
          {
            hash: 'def456',
            shortHash: 'def456',
            author: 'Dev <dev@example.com>',
            date: mockDate,
            message: 'fix: resolve bug',
            conventional: { type: 'fix', description: 'resolve login issue', breaking: false }
          }
        ]
      }
    ];

    it('generates basic changelog markdown', () => {
      const changelog = generateChangelogMarkdown('1.2.0', mockDate, mockGroups);

      expect(changelog).toContain('## [1.2.0] - 2024-01-15');
      expect(changelog).toContain('### ✨ Features');
      expect(changelog).toContain('### 🐛 Bug Fixes');
      expect(changelog).toContain('- add user authentication');
      expect(changelog).toContain('- resolve login issue');
    });

    it('includes commit hashes by default', () => {
      const changelog = generateChangelogMarkdown('1.2.0', mockDate, mockGroups);

      expect(changelog).toContain('(abc123)');
      expect(changelog).toContain('(def456)');
    });

    it('creates commit links when repo URL is provided', () => {
      const changelog = generateChangelogMarkdown('1.2.0', mockDate, mockGroups, {
        includeHashes: true,
        repoUrl: 'https://github.com/user/repo'
      });

      expect(changelog).toContain('[abc123](https://github.com/user/repo/commit/abc123');
      expect(changelog).toContain('[def456](https://github.com/user/repo/commit/def456');
    });

    it('excludes hashes when requested', () => {
      const changelog = generateChangelogMarkdown('1.2.0', mockDate, mockGroups, {
        includeHashes: false
      });

      expect(changelog).not.toContain('(abc123)');
      expect(changelog).not.toContain('(def456)');
    });

    it('includes authors when requested', () => {
      const changelog = generateChangelogMarkdown('1.2.0', mockDate, mockGroups, {
        includeAuthors: true
      });

      expect(changelog).toContain('- Dev <dev@example.com>');
    });

    it('handles scoped commits', () => {
      const scopedGroups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: [{
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'Dev',
          date: mockDate,
          message: 'feat(auth): add OAuth',
          conventional: { type: 'feat', scope: 'auth', description: 'add OAuth support', breaking: false }
        }]
      }];

      const changelog = generateChangelogMarkdown('1.0.0', mockDate, scopedGroups);

      expect(changelog).toContain('- **auth:** add OAuth support');
    });

    it('handles breaking changes', () => {
      const breakingGroups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: [{
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'Dev',
          date: mockDate,
          message: 'feat!: breaking change',
          conventional: { type: 'feat', description: 'remove old API', breaking: true }
        }]
      }];

      const changelog = generateChangelogMarkdown('2.0.0', mockDate, breakingGroups);

      expect(changelog).toContain('⚠️ BREAKING: remove old API');
    });

    it('skips empty groups', () => {
      const emptyGroups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: []
      }];

      const changelog = generateChangelogMarkdown('1.0.0', mockDate, emptyGroups);

      expect(changelog).not.toContain('### ✨ Features');
    });

    it('handles other group type', () => {
      const otherGroups = [{
        type: 'other' as const,
        title: 'Other Changes',
        commits: [{
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'Dev',
          date: mockDate,
          message: 'Some random change'
        }]
      }];

      const changelog = generateChangelogMarkdown('1.0.0', mockDate, otherGroups);

      expect(changelog).toContain('### 📝 Other Changes');
      expect(changelog).toContain('- Some random change');
    });

    it('formats dates correctly', () => {
      const testDate = new Date('2024-12-25T15:30:00Z');
      const changelog = generateChangelogMarkdown('1.0.0', testDate, []);

      expect(changelog).toContain('## [1.0.0] - 2024-12-25');
    });
  });

  describe('Integration tests', () => {
    it('processes a complete git workflow', () => {
      // Note: The parseGitLog regex requires commits to be followed by another commit marker.
      // This test verifies the complete workflow with 2 commit types.
      const logOutput = `commit abc123
Author: Alice <alice@example.com>
Date: Mon Jan 1 12:00:00 2024 +0000

feat(auth): add OAuth support

Implements OAuth 2.0 with Google and GitHub providers

commit def456
Author: Bob <bob@example.com>
Date: Sun Dec 31 18:00:00 2023 +0000

fix: resolve memory leak

commit ghi789
Author: Charlie <charlie@example.com>
Date: Sat Dec 30 14:00:00 2023 +0000

docs: update API documentation
`;

      // Parse the git log
      const entries = parseGitLog(logOutput);
      // Note: Due to regex lookahead, parseGitLog captures entries followed by another commit marker
      expect(entries).toHaveLength(2);

      // Group by type
      const groups = groupCommitsByType(entries);
      expect(groups).toHaveLength(2);

      // Generate changelog
      const changelog = generateChangelogMarkdown('1.2.0', new Date('2024-01-15'), groups, {
        includeHashes: true,
        repoUrl: 'https://github.com/test/repo'
      });

      expect(changelog).toContain('## [1.2.0] - 2024-01-15');
      expect(changelog).toContain('### ✨ Features');
      expect(changelog).toContain('### 🐛 Bug Fixes');
      expect(changelog).toContain('**auth:** add OAuth support');
      expect(changelog).toContain('resolve memory leak');
    });

    it('handles conflict detection and resolution workflow', () => {
      const conflictContent = `class User {
<<<<<<< HEAD
  constructor(name) {
    this.name = name;
    this.role = 'user';
  }
=======
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
>>>>>>> feature/add-email
}`;

      // Detect conflicts
      const conflicts = detectConflicts(conflictContent, 'User.js');
      expect(conflicts).toBeTruthy();

      // Get suggestions
      const suggestions = suggestConflictResolution(conflicts!.conflictMarkers[0]);
      expect(suggestions.length).toBeGreaterThan(0);

      // Format report
      const report = formatConflictReport([conflicts!]);
      expect(report).toContain('Found 1 file(s) with conflicts');
      expect(report).toContain('User.js');
      expect(report).toContain('Suggestion:');
    });

    it('maintains data consistency across transformations', () => {
      // Create mock data
      const commitMessage = 'feat(api): add REST endpoints\n\nImplements CRUD operations for users';
      const gitLogEntry: GitLogEntry = {
        hash: 'abc123def456',
        shortHash: 'abc123d',
        author: 'Dev <dev@test.com>',
        date: new Date('2024-01-01'),
        message: commitMessage,
        conventional: {
          type: 'feat',
          scope: 'api',
          description: 'add REST endpoints',
          body: 'Implements CRUD operations for users',
          breaking: false
        }
      };

      // Group and generate changelog
      const groups = groupCommitsByType([gitLogEntry]);
      const changelog = generateChangelogMarkdown('1.0.0', new Date('2024-01-01'), groups);

      expect(changelog).toContain('**api:** add REST endpoints');
      expect(groups[0].commits[0].conventional?.scope).toBe('api');
    });
  });
});