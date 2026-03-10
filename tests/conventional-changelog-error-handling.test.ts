import { describe, it, expect } from 'vitest';
import {
  generateChangelogMarkdown,
  groupCommitsByType,
  parseConventionalCommit,
  createConventionalCommit,
  type GitLogEntry,
  type ChangelogGroup,
} from '../packages/core/src/utils';

describe('Conventional Changelog - Error Handling and Edge Cases', () => {
  describe('generateChangelogMarkdown - Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => {
        generateChangelogMarkdown('1.0.0', new Date(), null as any);
      }).not.toThrow();

      expect(() => {
        generateChangelogMarkdown('1.0.0', new Date(), undefined as any);
      }).not.toThrow();
    });

    it('should handle invalid date objects', () => {
      const groups: ChangelogGroup[] = [];
      const invalidDate = new Date('invalid');

      const markdown = generateChangelogMarkdown('1.0.0', invalidDate, groups);
      // Should handle gracefully, might produce NaN date
      expect(typeof markdown).toBe('string');
    });

    it('should handle malformed commit objects', () => {
      const malformedGroups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [
          {
            hash: '', // empty hash
            shortHash: null as any, // null shortHash
            author: undefined as any, // undefined author
            date: null as any, // null date
            message: '', // empty message
            conventional: null as any, // null conventional
          },
          // Missing required fields
          {} as any,
        ]
      }];

      expect(() => {
        const markdown = generateChangelogMarkdown('1.0.0', new Date(), malformedGroups);
        expect(typeof markdown).toBe('string');
      }).not.toThrow();
    });

    it('should handle extremely long version strings', () => {
      const longVersion = 'v'.repeat(1000) + '1.0.0' + '-beta.1'.repeat(100);
      const groups: ChangelogGroup[] = [];

      const markdown = generateChangelogMarkdown(longVersion, new Date(), groups);
      expect(markdown).toContain(longVersion);
    });

    it('should handle special characters in version strings', () => {
      const specialVersions = [
        '1.0.0-α.β.γ', // Greek letters
        '1.0.0-🚀.✨', // Emojis
        '1.0.0-"quotes"', // Quotes
        '1.0.0-<tags>', // HTML-like tags
        '1.0.0-[brackets]', // Brackets
      ];

      specialVersions.forEach(version => {
        const markdown = generateChangelogMarkdown(version, new Date(), []);
        expect(markdown).toContain(`## [${version}]`);
      });
    });

    it('should handle commits with malformed conventional data', () => {
      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [{
          hash: 'test123',
          shortHash: 'test123',
          author: 'Test User',
          date: new Date(),
          message: 'feat: test',
          conventional: {
            type: null as any, // null type
            description: undefined as any, // undefined description
            breaking: 'not a boolean' as any, // invalid breaking
            scope: 123 as any, // number instead of string
            body: {} as any, // object instead of string
          },
        }]
      }];

      expect(() => {
        const markdown = generateChangelogMarkdown('1.0.0', new Date(), groups);
        expect(typeof markdown).toBe('string');
      }).not.toThrow();
    });

    it('should handle circular references in commit objects', () => {
      const commit: any = {
        hash: 'circular123',
        shortHash: 'circular123',
        author: 'Test User',
        date: new Date(),
        message: 'feat: circular test',
      };

      // Create circular reference
      commit.circular = commit;

      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [commit]
      }];

      expect(() => {
        const markdown = generateChangelogMarkdown('1.0.0', new Date(), groups);
        expect(typeof markdown).toBe('string');
      }).not.toThrow();
    });
  });

  describe('groupCommitsByType - Error Handling', () => {
    it('should handle null and undefined input', () => {
      expect(() => {
        groupCommitsByType(null as any);
      }).not.toThrow();

      expect(() => {
        groupCommitsByType(undefined as any);
      }).not.toThrow();
    });

    it('should handle malformed GitLogEntry objects', () => {
      const malformedEntries = [
        null,
        undefined,
        {},
        { hash: 'test' }, // missing required fields
        { message: 'test' }, // missing required fields
        {
          hash: null,
          shortHash: undefined,
          author: 123,
          date: 'not a date',
          message: {},
          conventional: 'not an object',
        },
      ] as any;

      expect(() => {
        const groups = groupCommitsByType(malformedEntries);
        expect(Array.isArray(groups)).toBe(true);
      }).not.toThrow();
    });

    it('should handle commits with invalid conventional types', () => {
      const entriesWithInvalidTypes: GitLogEntry[] = [
        {
          hash: 'invalid1',
          shortHash: 'invalid1',
          author: 'User',
          date: new Date(),
          message: 'invalid: test',
          conventional: { type: '', description: 'test', breaking: false },
        },
        {
          hash: 'invalid2',
          shortHash: 'invalid2',
          author: 'User',
          date: new Date(),
          message: 'null: test',
          conventional: { type: null as any, description: 'test', breaking: false },
        },
        {
          hash: 'invalid3',
          shortHash: 'invalid3',
          author: 'User',
          date: new Date(),
          message: 'undefined: test',
          conventional: { type: undefined as any, description: 'test', breaking: false },
        },
      ];

      const groups = groupCommitsByType(entriesWithInvalidTypes);

      // Should all go to 'other' group
      expect(groups.every(group => group.type === 'other')).toBe(true);
    });
  });

  describe('parseConventionalCommit - Error Handling', () => {
    it('should handle null and undefined input', () => {
      expect(parseConventionalCommit(null as any)).toBe(null);
      expect(parseConventionalCommit(undefined as any)).toBe(null);
    });

    it('should handle non-string input', () => {
      const nonStringInputs = [
        123,
        {},
        [],
        true,
        Symbol('test'),
      ] as any;

      nonStringInputs.forEach(input => {
        expect(() => parseConventionalCommit(input)).not.toThrow();
      });
    });

    it('should handle extremely malformed conventional commit patterns', () => {
      const malformedPatterns = [
        'feat((((((: broken parentheses',
        'feat)): reversed parentheses',
        'feat((scope)): double opening',
        'feat(scope))): double closing',
        'feat(: missing scope closing',
        'feat): missing scope opening',
        'feat(scope: missing colon inside',
        'feat(scope(nested): nested parentheses',
      ];

      malformedPatterns.forEach(pattern => {
        expect(() => {
          const result = parseConventionalCommit(pattern);
          // Should either return null or a valid object
          if (result) {
            expect(typeof result.type).toBe('string');
          }
        }).not.toThrow();
      });
    });

    it('should handle unicode and special characters in commit messages', () => {
      const unicodeMessages = [
        'feat: добавить поддержку русского языка', // Cyrillic
        'feat: 新機能を追加', // Japanese
        'feat: إضافة ميزة جديدة', // Arabic
        'feat: add support for 🚀 emojis ✨', // Emojis
        'feat: handle null (\\0) characters', // Null character
        'feat: line\\nbreaks\\tin\\rmessage', // Escape sequences
      ];

      unicodeMessages.forEach(message => {
        expect(() => {
          const result = parseConventionalCommit(message);
          if (result) {
            expect(typeof result.description).toBe('string');
          }
        }).not.toThrow();
      });
    });

    it('should handle extremely long commit messages without performance issues', () => {
      const longType = 'feat';
      const longScope = 'a'.repeat(10000);
      const longDescription = 'b'.repeat(50000);
      const longBody = 'c'.repeat(100000);

      // Use actual newlines instead of escaped sequences
      const longMessage = `${longType}(${longScope}): ${longDescription}\n\n${longBody}`;

      const startTime = Date.now();
      const result = parseConventionalCommit(longMessage);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      if (result) {
        expect(result.type).toBe(longType);
        expect(result.scope).toBe(longScope);
        expect(result.description).toBe(longDescription);
      }
    });
  });

  describe('createConventionalCommit - Error Handling', () => {
    it('should handle null and undefined inputs', () => {
      expect(() => {
        createConventionalCommit(null as any, null as any);
      }).not.toThrow();

      expect(() => {
        createConventionalCommit(undefined as any, undefined as any);
      }).not.toThrow();
    });

    it('should handle empty strings and whitespace', () => {
      const result1 = createConventionalCommit('', '');
      expect(result1).toContain(':');

      const result2 = createConventionalCommit('   ', '   ');
      expect(result2).toContain(':');
    });

    it('should handle special characters in type and description', () => {
      const specialChars = ['!@#$%^&*()', '<>[]{}', '"\'``', '\\n\\t\\r'];

      specialChars.forEach(chars => {
        expect(() => {
          const result = createConventionalCommit(chars, chars);
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle very long inputs', () => {
      const longType = 'a'.repeat(1000);
      const longDescription = 'b'.repeat(10000);

      const result = createConventionalCommit(longType, longDescription);
      expect(result).toContain(longType);
      expect(result).toContain(longDescription);
    });
  });

  describe('Edge Cases - Data Type Validation', () => {
    it('should handle Date edge cases in commits', () => {
      const dateEdgeCases = [
        new Date(0), // Unix epoch
        new Date('1970-01-01'), // Epoch
        new Date('2038-01-19'), // 32-bit timestamp limit
        new Date('9999-12-31'), // Far future
        new Date(-8640000000000000), // Min safe date
        new Date(8640000000000000), // Max safe date
      ];

      dateEdgeCases.forEach(date => {
        const groups: ChangelogGroup[] = [{
          type: 'feat',
          title: 'Features',
          commits: [{
            hash: 'date-test',
            shortHash: 'date-test',
            author: 'Test',
            date: date,
            message: 'feat: date test',
          }]
        }];

        expect(() => {
          const markdown = generateChangelogMarkdown('1.0.0', date, groups);
          expect(typeof markdown).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle boolean edge cases', () => {
      const booleanEdgeCases = [
        true,
        false,
        'true',
        'false',
        1,
        0,
        null,
        undefined,
      ] as any;

      booleanEdgeCases.forEach(breaking => {
        const groups: ChangelogGroup[] = [{
          type: 'feat',
          title: 'Features',
          commits: [{
            hash: 'bool-test',
            shortHash: 'bool-test',
            author: 'Test',
            date: new Date(),
            message: 'feat: bool test',
            conventional: { type: 'feat', description: 'test', breaking },
          }]
        }];

        expect(() => {
          const markdown = generateChangelogMarkdown('1.0.0', new Date(), groups);
          expect(typeof markdown).toBe('string');
        }).not.toThrow();
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large numbers of commits efficiently', () => {
      const largeNumberOfCommits: GitLogEntry[] = Array.from({ length: 10000 }, (_, i) => ({
        hash: `commit-${i}`.padStart(40, '0'),
        shortHash: `commit-${i}`.substring(0, 7),
        author: `Author ${i} <author${i}@example.com>`,
        date: new Date(Date.now() - i * 1000),
        message: `feat: feature ${i}`,
        conventional: { type: 'feat', description: `feature ${i}`, breaking: i % 100 === 0 },
      }));

      const startTime = Date.now();
      const groups = groupCommitsByType(largeNumberOfCommits);
      const markdown = generateChangelogMarkdown('1.0.0', new Date(), groups);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested commit data', () => {
      const deepCommit: any = { hash: 'deep' };
      let current = deepCommit;

      // Create deep nesting (but not circular)
      for (let i = 0; i < 1000; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const groups: ChangelogGroup[] = [{
        type: 'feat',
        title: 'Features',
        commits: [{
          ...deepCommit,
          shortHash: 'deep',
          author: 'Test',
          date: new Date(),
          message: 'feat: deep test',
        }]
      }];

      expect(() => {
        const markdown = generateChangelogMarkdown('1.0.0', new Date(), groups);
        expect(typeof markdown).toBe('string');
      }).not.toThrow();
    });
  });
});