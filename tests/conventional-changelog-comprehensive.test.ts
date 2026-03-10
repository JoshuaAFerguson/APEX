import { describe, it, expect } from 'vitest';
import {
  generateChangelogMarkdown,
  groupCommitsByType,
  parseConventionalCommit,
  createConventionalCommit,
  suggestCommitType,
  COMMIT_TYPES,
  type GitLogEntry,
  type ChangelogGroup,
  type ConventionalCommit,
  type CommitType,
} from '../packages/core/src/utils';

describe('Conventional Changelog - Comprehensive Tests', () => {
  describe('generateChangelogMarkdown - Edge Cases', () => {
    it('should handle empty groups array', () => {
      const markdown = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), []);

      expect(markdown).toBe('## [1.0.0] - 2024-01-15\n\n');
    });

    it('should handle null/undefined options', () => {
      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [{
          hash: 'abc123full',
          shortHash: 'abc123',
          author: 'Test User <test@example.com>',
          date: new Date(),
          message: 'feat: test feature',
          conventional: { type: 'feat', description: 'test feature', breaking: false },
        }]
      }];

      const markdown1 = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups, undefined);
      const markdown2 = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups, null as any);

      expect(markdown1).toContain('- test feature (abc123)');
      expect(markdown2).toContain('- test feature (abc123)');
    });

    it('should handle commits without conventional parsing', () => {
      const groups: ChangelogGroup[] = [{
        type: 'other',
        title: 'Other Changes',
        commits: [{
          hash: 'xyz789',
          shortHash: 'xyz789',
          author: 'Test User',
          date: new Date(),
          message: 'Some random commit message\nwith multiple lines',
          conventional: undefined,
        }]
      }];

      const markdown = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups);

      expect(markdown).toContain('### 📝 Other Changes');
      expect(markdown).toContain('- Some random commit message (xyz789)');
    });

    it('should handle multiline commit messages correctly', () => {
      const groups: ChangelogGroup[] = [{
        type: 'fix',
        title: 'Bug Fixes',
        commits: [{
          hash: 'def456',
          shortHash: 'def456',
          author: 'Test User',
          date: new Date(),
          message: 'fix: resolve critical bug\n\nThis is a longer description\nwith multiple lines',
          conventional: { type: 'fix', description: 'resolve critical bug', breaking: false },
        }]
      }];

      const markdown = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups);

      expect(markdown).toContain('- resolve critical bug (def456)');
      expect(markdown).not.toContain('This is a longer description');
    });

    it('should handle all commit types with proper emojis', () => {
      const allTypes: (CommitType | 'other')[] = [
        'feat', 'fix', 'docs', 'style', 'refactor',
        'perf', 'test', 'build', 'ci', 'chore', 'revert', 'other'
      ];

      const groups: ChangelogGroup[] = allTypes.map(type => ({
        type,
        title: type === 'other' ? 'Other Changes' : COMMIT_TYPES[type as CommitType].title,
        commits: [{
          hash: `${type}123`,
          shortHash: `${type}123`,
          author: 'Test User',
          date: new Date(),
          message: `${type}: test ${type}`,
          conventional: type !== 'other' ? { type, description: `test ${type}`, breaking: false } : undefined,
        }]
      }));

      const markdown = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups);

      // Check that all expected emojis are present
      expect(markdown).toContain('✨'); // feat
      expect(markdown).toContain('🐛'); // fix
      expect(markdown).toContain('📚'); // docs
      expect(markdown).toContain('💎'); // style
      expect(markdown).toContain('♻️'); // refactor
      expect(markdown).toContain('🚀'); // perf
      expect(markdown).toContain('🧪'); // test
      expect(markdown).toContain('📦'); // build
      expect(markdown).toContain('👷'); // ci
      expect(markdown).toContain('🔧'); // chore
      expect(markdown).toContain('⏪'); // revert
      expect(markdown).toContain('📝'); // other
    });

    it('should handle complex breaking change scenarios', () => {
      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [{
          hash: 'break123',
          shortHash: 'break123',
          author: 'Dev User',
          date: new Date(),
          message: 'feat!: add new API with breaking changes',
          conventional: {
            type: 'feat',
            description: 'add new API with breaking changes',
            breaking: true,
            scope: 'api',
            body: 'BREAKING CHANGE: old API removed'
          },
        }]
      }];

      const markdown = generateChangelogMarkdown('2.0.0', new Date('2024-01-15'), groups);

      expect(markdown).toContain('⚠️ BREAKING: **api:** add new API with breaking changes');
    });

    it('should handle special characters in descriptions', () => {
      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [{
          hash: 'special123',
          shortHash: 'special123',
          author: 'Test User',
          date: new Date(),
          message: 'feat: add support for "quotes" & <tags> [brackets]',
          conventional: {
            type: 'feat',
            description: 'add support for "quotes" & <tags> [brackets]',
            breaking: false
          },
        }]
      }];

      const markdown = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups);

      expect(markdown).toContain('- add support for "quotes" & <tags> [brackets]');
    });

    it('should handle edge case dates', () => {
      const groups: ChangelogGroup[] = [];

      // Test leap year
      const leapYear = generateChangelogMarkdown('1.0.0', new Date('2024-02-29'), groups);
      expect(leapYear).toContain('## [1.0.0] - 2024-02-29');

      // Test year boundaries
      const newYear = generateChangelogMarkdown('1.0.0', new Date('2025-01-01T00:00:00Z'), groups);
      expect(newYear).toContain('## [1.0.0] - 2025-01-01');

      // Test timezone independence
      const utcTime = generateChangelogMarkdown('1.0.0', new Date('2024-12-31T23:59:59Z'), groups);
      expect(utcTime).toContain('## [1.0.0] - 2024-12-31');
    });

    it('should handle maximum length descriptions and data', () => {
      const longDescription = 'a'.repeat(1000);
      const longHash = 'f'.repeat(40); // Full SHA-1 hash
      const longAuthor = `${'Very Long Author Name '.repeat(10)}<very.long.email.address@example.domain.com>`;

      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [{
          hash: longHash,
          shortHash: longHash.substring(0, 7),
          author: longAuthor,
          date: new Date(),
          message: `feat: ${longDescription}`,
          conventional: { type: 'feat', description: longDescription, breaking: false },
        }]
      }];

      const markdown = generateChangelogMarkdown('1.0.0', new Date('2024-01-15'), groups, {
        includeAuthors: true,
        includeHashes: true,
        repoUrl: 'https://github.com/test/repo'
      });

      expect(markdown).toContain(longDescription);
      expect(markdown).toContain(`[${longHash.substring(0, 7)}]`);
      expect(markdown).toContain(longAuthor);
    });
  });

  describe('groupCommitsByType - Edge Cases', () => {
    it('should handle empty entries array', () => {
      const groups = groupCommitsByType([]);
      expect(groups).toHaveLength(0);
    });

    it('should handle commits with invalid conventional types', () => {
      const entries: GitLogEntry[] = [{
        hash: 'invalid123',
        shortHash: 'invalid123',
        author: 'Test User',
        date: new Date(),
        message: 'invalid: not a valid type',
        conventional: { type: 'invalid', description: 'not a valid type', breaking: false },
      }];

      const groups = groupCommitsByType(entries);

      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('other');
      expect(groups[0].title).toBe('Other Changes');
    });

    it('should maintain order of commit types as defined in COMMIT_TYPES', () => {
      const entries: GitLogEntry[] = [
        {
          hash: 'chore123',
          shortHash: 'chore123',
          author: 'User',
          date: new Date(),
          message: 'chore: update deps',
          conventional: { type: 'chore', description: 'update deps', breaking: false },
        },
        {
          hash: 'feat123',
          shortHash: 'feat123',
          author: 'User',
          date: new Date(),
          message: 'feat: new feature',
          conventional: { type: 'feat', description: 'new feature', breaking: false },
        },
        {
          hash: 'fix123',
          shortHash: 'fix123',
          author: 'User',
          date: new Date(),
          message: 'fix: bug fix',
          conventional: { type: 'fix', description: 'bug fix', breaking: false },
        },
      ];

      const groups = groupCommitsByType(entries);

      // Should be ordered as: feat, fix, chore (following COMMIT_TYPES order)
      expect(groups.map(g => g.type)).toEqual(['feat', 'fix', 'chore']);
    });

    it('should handle mixed conventional and non-conventional commits', () => {
      const entries: GitLogEntry[] = [
        {
          hash: 'conv123',
          shortHash: 'conv123',
          author: 'User',
          date: new Date(),
          message: 'feat: conventional commit',
          conventional: { type: 'feat', description: 'conventional commit', breaking: false },
        },
        {
          hash: 'nonconv123',
          shortHash: 'nonconv123',
          author: 'User',
          date: new Date(),
          message: 'random commit message',
          conventional: undefined,
        },
      ];

      const groups = groupCommitsByType(entries);

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.type === 'feat')?.commits).toHaveLength(1);
      expect(groups.find(g => g.type === 'other')?.commits).toHaveLength(1);
    });
  });

  describe('parseConventionalCommit - Edge Cases', () => {
    it('should handle malformed commit messages', () => {
      const malformedCases = [
        '',
        '   ',
        'feat',
        'feat:',
        'feat: ',
        ':description',
        'feat::double colon',
        'feat(scope:malformed scope',
        'feat(scope)description without colon',
      ];

      malformedCases.forEach(message => {
        const result = parseConventionalCommit(message);
        // Should either parse partially or return null
        if (result) {
          expect(typeof result.type).toBe('string');
        }
      });
    });

    it('should handle very long commit messages', () => {
      const longType = 'a'.repeat(100);
      const longScope = 'b'.repeat(200);
      const longDescription = 'c'.repeat(1000);
      const longBody = 'd'.repeat(5000);

      const message = `${longType}(${longScope}): ${longDescription}\n\n${longBody}`;
      const result = parseConventionalCommit(message);

      if (result) {
        expect(result.type).toBe(longType);
        expect(result.scope).toBe(longScope);
        expect(result.description).toBe(longDescription);
      }
    });

    it('should handle complex breaking change patterns', () => {
      const breakingCases = [
        'feat!: breaking with exclamation',
        'feat(scope)!: scoped breaking with exclamation',
        'feat: normal\n\nBREAKING CHANGE: in body',
        'feat: normal\n\nBREAKING CHANGE:\nin body multiline',
        'feat!: exclamation\n\nBREAKING CHANGE: both indicators',
      ];

      breakingCases.forEach(message => {
        const result = parseConventionalCommit(message);
        expect(result?.breaking).toBe(true);
      });
    });
  });

  describe('suggestCommitType - Comprehensive Cases', () => {
    it('should handle empty file arrays', () => {
      const result = suggestCommitType([]);
      expect(result).toBe('feat'); // Default behavior
    });

    it('should handle mixed file types with precedence', () => {
      const files = [
        'src/component.tsx', // could be feat
        'src/utils.test.ts', // test
        'README.md', // docs
        'package.json', // build
      ];

      const result = suggestCommitType(files);
      // Should suggest the most specific type found
      expect(['test', 'docs', 'build']).toContain(result);
    });

    it('should handle case-insensitive file extensions', () => {
      const testCases = [
        { files: ['TEST.MD', 'DOCS/README.MD'], expected: 'docs' },
        { files: ['SRC/UTILS.TEST.TS'], expected: 'test' },
        { files: ['STYLES.CSS', 'THEME.SCSS'], expected: 'style' },
      ];

      testCases.forEach(({ files, expected }) => {
        expect(suggestCommitType(files)).toBe(expected);
      });
    });

    it('should handle complex path patterns', () => {
      const complexCases = [
        { files: ['packages/core/src/__tests__/utils.test.ts'], expected: 'test' },
        { files: ['.github/workflows/ci.yml', '.circleci/config.yml'], expected: 'ci' },
        { files: ['docs/api/README.md', 'documentation/guide.md'], expected: 'docs' },
        { files: ['src/components/Button.styled.tsx'], expected: 'style' },
      ];

      complexCases.forEach(({ files, expected }) => {
        expect(suggestCommitType(files)).toBe(expected);
      });
    });

    it('should handle miscellaneous file types', () => {
      const miscFiles = [
        'config.json',
        'data.xml',
        'logs.txt',
        'random-file.csv',
        'config/database.yml',
      ];

      const result = suggestCommitType(miscFiles);
      expect(result).toBe('chore');
    });
  });

  describe('Integration - Complete Workflow', () => {
    it('should process a complete changelog workflow with all commit types', () => {
      // Create a comprehensive set of commits
      const entries: GitLogEntry[] = [
        {
          hash: 'feat001',
          shortHash: 'feat001',
          author: 'Dev1 <dev1@example.com>',
          date: new Date('2024-01-10'),
          message: 'feat(auth): add OAuth2 integration',
          conventional: { type: 'feat', scope: 'auth', description: 'add OAuth2 integration', breaking: false },
        },
        {
          hash: 'fix001',
          shortHash: 'fix001',
          author: 'Dev2 <dev2@example.com>',
          date: new Date('2024-01-11'),
          message: 'fix: resolve memory leak in worker process',
          conventional: { type: 'fix', description: 'resolve memory leak in worker process', breaking: false },
        },
        {
          hash: 'break001',
          shortHash: 'break001',
          author: 'Dev3 <dev3@example.com>',
          date: new Date('2024-01-12'),
          message: 'feat!: remove deprecated API endpoints',
          conventional: { type: 'feat', description: 'remove deprecated API endpoints', breaking: true },
        },
        {
          hash: 'other001',
          shortHash: 'other001',
          author: 'Dev4 <dev4@example.com>',
          date: new Date('2024-01-13'),
          message: 'Update some random files',
          conventional: undefined,
        },
      ];

      // Group the commits
      const groups = groupCommitsByType(entries);

      // Generate changelog
      const changelog = generateChangelogMarkdown('2.0.0', new Date('2024-01-15'), groups, {
        includeHashes: true,
        includeAuthors: true,
        repoUrl: 'https://github.com/test/project'
      });

      // Verify structure
      expect(changelog).toContain('## [2.0.0] - 2024-01-15');
      expect(changelog).toContain('### ✨ Features');
      expect(changelog).toContain('### 🐛 Bug Fixes');
      expect(changelog).toContain('### 📝 Other Changes');

      // Verify content
      expect(changelog).toContain('**auth:** add OAuth2 integration');
      expect(changelog).toContain('⚠️ BREAKING: remove deprecated API endpoints');
      expect(changelog).toContain('resolve memory leak in worker process');
      expect(changelog).toContain('Update some random files');

      // Verify links and authors
      expect(changelog).toContain('[feat001](https://github.com/test/project/commit/feat001)');
      expect(changelog).toContain('- Dev1 <dev1@example.com>');
      expect(changelog).toContain('- Dev2 <dev2@example.com>');
    });
  });
});