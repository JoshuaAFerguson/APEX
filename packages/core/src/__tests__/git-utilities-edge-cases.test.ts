import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  type ConflictInfo,
  type GitLogEntry
} from '../utils';

/**
 * Edge cases and advanced scenarios for Git utilities
 *
 * This test file focuses on challenging edge cases, malformed input,
 * and boundary conditions for Git utility functions.
 */

describe('Git Utilities - Edge Cases and Advanced Scenarios', () => {

  describe('detectConflicts edge cases', () => {

    it('should handle nested conflict markers', () => {
      const fileContent = `
<<<<<<< HEAD
function outer() {
<<<<<<< INNER
  inner conflict
=======
  inner resolution
>>>>>>> INNER
}
=======
function outer() {
  outer resolution
}
>>>>>>> feature
`;

      const conflicts = detectConflicts(fileContent, 'nested.js');
      // Should detect the outer conflict, inner markers treated as content
      expect(conflicts?.conflictMarkers).toHaveLength(1);
      expect(conflicts?.conflictMarkers[0].startLine).toBe(2);
    });

    it('should handle conflict markers in comments', () => {
      const fileContent = `
// This is a comment about <<<<<<< markers
function test() {
<<<<<<< HEAD
  return "real conflict";
=======
  return "resolution";
>>>>>>> feature
}
`;

      const conflicts = detectConflicts(fileContent, 'comments.js');
      expect(conflicts?.conflictMarkers).toHaveLength(1);
      expect(conflicts?.conflictMarkers[0].currentContent).toBe('  return "real conflict";');
    });

    it('should handle malformed conflict markers', () => {
      const fileContent = `
<<<<<<<
incomplete marker
=======
resolution
>>>>>>> feature

function test() {
<<<<<<< HEAD
valid conflict
=======
valid resolution
>>>>>>>
}
`;

      const conflicts = detectConflicts(fileContent, 'malformed.js');
      // Should only detect the second, properly formed conflict
      expect(conflicts?.conflictMarkers).toHaveLength(1);
      expect(conflicts?.conflictMarkers[0].currentContent).toBe('valid conflict');
    });

    it('should handle very long conflict sections', () => {
      const longContent = 'line\n'.repeat(1000);
      const fileContent = `
<<<<<<< HEAD
${longContent}
=======
different content
>>>>>>> feature
`;

      const conflicts = detectConflicts(fileContent, 'long.js');
      expect(conflicts?.conflictMarkers).toHaveLength(1);
      expect(conflicts?.conflictMarkers[0].currentContent.split('\n')).toHaveLength(1001);
    });

    it('should handle conflicts with unusual branch names', () => {
      const fileContent = `
<<<<<<< refs/heads/feature/user-auth-2024-01-01-v2
current content
=======
incoming content
>>>>>>> origin/feature/complex.branch.name.with.dots
`;

      const conflicts = detectConflicts(fileContent, 'branches.js');
      expect(conflicts?.baseBranch).toBe('refs/heads/feature/user-auth-2024-01-01-v2');
      expect(conflicts?.incomingBranch).toBe('origin/feature/complex.branch.name.with.dots');
    });

    it('should handle conflicts with unicode content', () => {
      const fileContent = `
<<<<<<< HEAD
function hello() { return "Hello 世界"; }
=======
function hello() { return "こんにちは世界"; }
>>>>>>> feature
`;

      const conflicts = detectConflicts(fileContent, 'unicode.js');
      expect(conflicts?.conflictMarkers[0].currentContent).toContain('世界');
      expect(conflicts?.conflictMarkers[0].incomingContent).toContain('こんにちは世界');
    });

    it('should handle files with only conflict markers and no other content', () => {
      const fileContent = `<<<<<<< HEAD
conflict only
=======
resolution only
>>>>>>> feature`;

      const conflicts = detectConflicts(fileContent, 'conflict-only.js');
      expect(conflicts?.conflictMarkers).toHaveLength(1);
      expect(conflicts?.conflictMarkers[0].startLine).toBe(1);
      expect(conflicts?.conflictMarkers[0].endLine).toBe(4);
    });

    it('should handle multiple consecutive conflicts', () => {
      const fileContent = `
<<<<<<< HEAD
first conflict
=======
first resolution
>>>>>>> feature
<<<<<<< HEAD
second conflict
=======
second resolution
>>>>>>> feature
`;

      const conflicts = detectConflicts(fileContent, 'consecutive.js');
      expect(conflicts?.conflictMarkers).toHaveLength(2);
      expect(conflicts?.conflictMarkers[1].startLine).toBe(6);
    });

    it('should handle conflicts with empty sides', () => {
      const fileContent = `
<<<<<<< HEAD
=======
incoming content
>>>>>>> feature

<<<<<<< HEAD
current content
=======
>>>>>>> feature
`;

      const conflicts = detectConflicts(fileContent, 'empty-sides.js');
      expect(conflicts?.conflictMarkers).toHaveLength(2);
      expect(conflicts?.conflictMarkers[0].currentContent).toBe('');
      expect(conflicts?.conflictMarkers[1].incomingContent).toBe('');
    });
  });

  describe('suggestConflictResolution edge cases', () => {

    it('should handle very similar content with minimal differences', () => {
      const marker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'function test() { return "value"; }',
        incomingContent: 'function test() { return "value" ; }'  // Extra space
      };

      const suggestions = suggestConflictResolution(marker);
      const highConfidence = suggestions.filter(s => s.confidence === 'high');
      expect(highConfidence).toHaveLength(1);
      expect(highConfidence[0].description).toContain('contents are identical');
    });

    it('should handle content with only whitespace differences', () => {
      const marker = {
        startLine: 1,
        endLine: 5,
        currentContent: '  function test() {\n    return true;\n  }',
        incomingContent: 'function test() {\n  return true;\n}'
      };

      const suggestions = suggestConflictResolution(marker);
      const identicalSuggestion = suggestions.find(s => s.description.includes('identical'));
      expect(identicalSuggestion?.confidence).toBe('high');
    });

    it('should handle extremely long content', () => {
      const longContent = 'A very long line of code that goes on and on '.repeat(100);
      const marker = {
        startLine: 1,
        endLine: 5,
        currentContent: longContent,
        incomingContent: longContent + 'extra'
      };

      const suggestions = suggestConflictResolution(marker);
      const incomingSuggestion = suggestions.find(s => s.type === 'keep-incoming');
      expect(incomingSuggestion?.description).toContain('includes current content plus additions');
    });

    it('should handle binary-like content', () => {
      const marker = {
        startLine: 1,
        endLine: 5,
        currentContent: String.fromCharCode(...Array(50).fill(0).map((_, i) => i + 65)),
        incomingContent: String.fromCharCode(...Array(50).fill(0).map((_, i) => i + 97))
      };

      const suggestions = suggestConflictResolution(marker);
      // Should still provide all suggestion types
      expect(suggestions.some(s => s.type === 'keep-both')).toBe(true);
      expect(suggestions.some(s => s.type === 'manual')).toBe(true);
    });

    it('should handle content with special regex characters', () => {
      const marker = {
        startLine: 1,
        endLine: 5,
        currentContent: 'const regex = /[.*+?^${}()|[\\]\\\\]/g;',
        incomingContent: 'const regex = /[.*+?^${}()|[\\]\\\\]/gi;'  // Added 'i' flag
      };

      const suggestions = suggestConflictResolution(marker);
      const incomingSuggestion = suggestions.find(s => s.type === 'keep-incoming' && s.confidence === 'medium');
      expect(incomingSuggestion?.description).toContain('includes current content plus additions');
    });
  });

  describe('parseGitLog edge cases', () => {

    it('should handle log entries with unusual formatting', () => {
      const logOutput = `commit 1234567890abcdef1234567890abcdef12345678
Author:     John   Doe     <john@example.com>
Date:   Mon Jan 1 12:00:00 2023 +0000

    feat: test commit with extra spaces

commit abcdef1234567890abcdef1234567890abcdef12
Author: Jane Smith <jane@example.com>
Date:Mon Jan 1 11:00:00 2023

fix: commit without space after Date:`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(2);
      expect(entries[0].author).toBe('John   Doe     <john@example.com>');
      expect(entries[1].message).toBe('fix: commit without space after Date:');
    });

    it('should handle commits with no message', () => {
      const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('');
      expect(entries[0].conventional).toBeUndefined();
    });

    it('should handle commits with very long messages', () => {
      const longMessage = 'This is a very long commit message that goes on and on '.repeat(50);
      const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

${longMessage}`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(1);
      expect(entries[0].message.length).toBeGreaterThan(2000);
    });

    it('should handle commits with unusual author formats', () => {
      const logOutput = `commit abc123
Author: John Doe
Date: Mon Jan 1 12:00:00 2023

feat: no email

commit def456
Author: <anonymous@example.com>
Date: Mon Jan 1 12:00:00 2023

feat: no name

commit ghi789
Author:
Date: Mon Jan 1 12:00:00 2023

feat: empty author`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(3);
      expect(entries[0].author).toBe('John Doe');
      expect(entries[1].author).toBe('<anonymous@example.com>');
      expect(entries[2].author).toBe('');
    });

    it('should handle malformed dates gracefully', () => {
      const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Invalid Date Format

feat: test with bad date

commit def456
Author: Jane Smith <jane@example.com>
Date:

feat: empty date`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(2);
      expect(isNaN(entries[0].date.getTime())).toBe(true);
      expect(isNaN(entries[1].date.getTime())).toBe(true);
    });

    it('should handle git log with merge commits', () => {
      const logOutput = `commit abc123
Merge: def456 ghi789
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

Merge branch 'feature' into main

commit def456
Author: Jane Smith <jane@example.com>
Date: Mon Jan 1 11:00:00 2023

feat: add feature`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe('Merge branch \'feature\' into main');
      expect(entries[1].conventional?.type).toBe('feat');
    });

    it('should handle empty or malformed git log', () => {
      expect(parseGitLog('')).toEqual([]);
      expect(parseGitLog('Not a git log')).toEqual([]);
      expect(parseGitLog('commit')).toEqual([]);
      expect(parseGitLog('commit abc\nAuthor:')).toEqual([]);
    });

    it('should handle commits with special characters in hash', () => {
      const logOutput = `commit 0123456789abcdef0123456789abcdef01234567
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

feat: commit with various characters`;

      const entries = parseGitLog(logOutput);
      expect(entries).toHaveLength(1);
      expect(entries[0].hash).toBe('0123456789abcdef0123456789abcdef01234567');
      expect(entries[0].shortHash).toBe('0123456');
    });
  });

  describe('groupCommitsByType edge cases', () => {

    it('should handle commits with invalid/unknown types', () => {
      const entries: GitLogEntry[] = [
        {
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'John',
          date: new Date(),
          message: 'unknown: weird commit type',
          conventional: { type: 'unknown' as any, description: 'weird commit type', breaking: false }
        },
        {
          hash: 'def456',
          shortHash: 'def456',
          author: 'Jane',
          date: new Date(),
          message: 'randomtype: another weird one',
          conventional: { type: 'randomtype' as any, description: 'another weird one', breaking: false }
        }
      ];

      const groups = groupCommitsByType(entries);
      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('other');
      expect(groups[0].commits).toHaveLength(2);
    });

    it('should handle massive number of commits efficiently', () => {
      const entries: GitLogEntry[] = Array(1000).fill(0).map((_, i) => ({
        hash: `commit${i}`,
        shortHash: `commit${i}`.slice(0, 7),
        author: `Author ${i}`,
        date: new Date(),
        message: `feat: feature ${i}`,
        conventional: { type: 'feat', description: `feature ${i}`, breaking: false }
      }));

      const groups = groupCommitsByType(entries);
      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('feat');
      expect(groups[0].commits).toHaveLength(1000);
    });

    it('should handle mixed valid and invalid commits', () => {
      const entries: GitLogEntry[] = [
        {
          hash: 'abc',
          shortHash: 'abc',
          author: 'John',
          date: new Date(),
          message: 'feat: valid commit',
          conventional: { type: 'feat', description: 'valid commit', breaking: false }
        },
        {
          hash: 'def',
          shortHash: 'def',
          author: 'Jane',
          date: new Date(),
          message: 'Not a conventional commit',
          conventional: undefined
        },
        {
          hash: 'ghi',
          shortHash: 'ghi',
          author: 'Bob',
          date: new Date(),
          message: 'fix: another valid commit',
          conventional: { type: 'fix', description: 'another valid commit', breaking: false }
        }
      ];

      const groups = groupCommitsByType(entries);
      expect(groups).toHaveLength(3);

      const featGroup = groups.find(g => g.type === 'feat');
      const fixGroup = groups.find(g => g.type === 'fix');
      const otherGroup = groups.find(g => g.type === 'other');

      expect(featGroup?.commits).toHaveLength(1);
      expect(fixGroup?.commits).toHaveLength(1);
      expect(otherGroup?.commits).toHaveLength(1);
    });
  });

  describe('generateChangelogMarkdown edge cases', () => {

    it('should handle commits with unusual scopes', () => {
      const groups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: [{
          hash: 'abc',
          shortHash: 'abc',
          author: 'John',
          date: new Date(),
          message: 'feat(api/v2/auth): complex scope',
          conventional: {
            type: 'feat',
            scope: 'api/v2/auth',
            description: 'complex scope',
            breaking: false
          }
        }]
      }];

      const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups);
      expect(changelog).toContain('**api/v2/auth:**');
    });

    it('should handle commits with very long descriptions', () => {
      const longDescription = 'This is a very long commit description that goes on and on '.repeat(10);
      const groups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: [{
          hash: 'abc',
          shortHash: 'abc',
          author: 'John',
          date: new Date(),
          message: `feat: ${longDescription}`,
          conventional: {
            type: 'feat',
            description: longDescription,
            breaking: false
          }
        }]
      }];

      const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups);
      expect(changelog).toContain(longDescription);
    });

    it('should handle dates with different timezones', () => {
      const date = new Date('2023-01-01T12:00:00-05:00'); // EST
      const changelog = generateChangelogMarkdown('1.0.0', date, []);
      expect(changelog).toContain('2023-01-01');
    });

    it('should handle special characters in version strings', () => {
      const changelog = generateChangelogMarkdown('1.0.0-alpha+build.123', new Date(), []);
      expect(changelog).toContain('[1.0.0-alpha+build.123]');
    });

    it('should handle extremely large number of commits', () => {
      const commits = Array(100).fill(0).map((_, i) => ({
        hash: `commit${i}`,
        shortHash: `commit${i}`.slice(0, 7),
        author: 'Author',
        date: new Date(),
        message: `feat: feature ${i}`,
        conventional: {
          type: 'feat',
          description: `feature ${i}`,
          breaking: false
        }
      }));

      const groups = [{
        type: 'feat' as const,
        title: 'Features',
        commits
      }];

      const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups);
      expect(changelog.split('\n').length).toBeGreaterThan(100);
    });

    it('should handle commits with missing conventional commit data', () => {
      const groups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: [{
          hash: 'abc',
          shortHash: 'abc',
          author: 'John',
          date: new Date(),
          message: 'Add new feature\n\nThis is a multi-line\ncommit message',
          conventional: undefined
        }]
      }];

      const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups);
      expect(changelog).toContain('Add new feature');
      expect(changelog).not.toContain('This is a multi-line');
    });

    it('should handle invalid or extremely long repository URLs', () => {
      const groups = [{
        type: 'feat' as const,
        title: 'Features',
        commits: [{
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'John',
          date: new Date(),
          message: 'feat: test',
          conventional: { type: 'feat', description: 'test', breaking: false }
        }]
      }];

      const veryLongUrl = 'https://github.com/' + 'very-long-path/'.repeat(50) + 'repo';
      const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups, {
        includeHashes: true,
        repoUrl: veryLongUrl
      });

      expect(changelog).toContain(`[abc123](${veryLongUrl}/commit/abc123)`);
    });

    it('should handle edge case with other type commits', () => {
      const groups = [{
        type: 'other' as const,
        title: 'Other Changes',
        commits: [{
          hash: 'abc',
          shortHash: 'abc',
          author: 'John',
          date: new Date(),
          message: 'Random commit message',
          conventional: undefined
        }]
      }];

      const changelog = generateChangelogMarkdown('1.0.0', new Date(), groups);
      expect(changelog).toContain('### 📝 Other Changes');
      expect(changelog).toContain('Random commit message');
    });
  });

  describe('performance and stress testing', () => {

    it('should handle very large conflict files efficiently', () => {
      const largeContent = 'line of code\n'.repeat(10000);
      const fileContent = `<<<<<<< HEAD\n${largeContent}=======\ndifferent content\n>>>>>>> feature`;

      const start = performance.now();
      const conflicts = detectConflicts(fileContent, 'large.js');
      const end = performance.now();

      expect(conflicts?.conflictMarkers).toHaveLength(1);
      expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle large git log efficiently', () => {
      const logEntries = Array(1000).fill(0).map((_, i) =>
        `commit ${i.toString(16).padStart(40, '0')}\nAuthor: Author ${i} <author${i}@example.com>\nDate: Mon Jan ${(i % 28) + 1} 12:00:00 2023\n\nfeat: commit ${i}`
      ).join('\n\n');

      const start = performance.now();
      const entries = parseGitLog(logEntries);
      const end = performance.now();

      expect(entries).toHaveLength(1000);
      expect(end - start).toBeLessThan(2000); // Should complete in less than 2 seconds
    });

    it('should handle memory efficiently with large datasets', () => {
      // Test that we don't have memory leaks with large datasets
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        const largeContent = 'content '.repeat(1000);
        const fileContent = `<<<<<<< HEAD\n${largeContent}\n=======\n${largeContent} modified\n>>>>>>> feature`;
        detectConflicts(fileContent, `file${i}.js`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});