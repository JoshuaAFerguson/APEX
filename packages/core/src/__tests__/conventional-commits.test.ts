import { describe, it, expect } from 'vitest';
import {
  parseConventionalCommit,
  createConventionalCommit,
  COMMIT_TYPES,
  suggestCommitType,
  type ConventionalCommit,
  type CommitType,
} from '../utils.js';

describe('Conventional Commits Utilities', () => {
  describe('parseConventionalCommit', () => {
    it('parses basic commit messages', () => {
      const result = parseConventionalCommit('feat: add new feature');

      expect(result).toEqual({
        type: 'feat',
        description: 'add new feature',
        breaking: false,
      });
    });

    it('parses commit messages with scope', () => {
      const result = parseConventionalCommit('fix(auth): resolve login issue');

      expect(result).toEqual({
        type: 'fix',
        scope: 'auth',
        description: 'resolve login issue',
        breaking: false,
      });
    });

    it('parses commit messages with body', () => {
      const message = 'feat: add user authentication\n\nImplements OAuth 2.0 flow with Google provider';
      const result = parseConventionalCommit(message);

      expect(result).toEqual({
        type: 'feat',
        description: 'add user authentication',
        body: 'Implements OAuth 2.0 flow with Google provider',
        breaking: false,
      });
    });

    it('parses breaking change with exclamation mark', () => {
      const result = parseConventionalCommit('feat!: remove deprecated API');

      expect(result).toEqual({
        type: 'feat',
        description: 'remove deprecated API',
        breaking: true,
      });
    });

    it('parses breaking change with scope and exclamation mark', () => {
      const result = parseConventionalCommit('refactor(api)!: change response format');

      expect(result).toEqual({
        type: 'refactor',
        scope: 'api',
        description: 'change response format',
        breaking: true,
      });
    });

    it('parses breaking change with body', () => {
      const message = 'feat!: update user model\n\nBREAKING CHANGE: user ID is now a UUID instead of integer';
      const result = parseConventionalCommit(message);

      expect(result).toEqual({
        type: 'feat',
        description: 'update user model',
        body: 'BREAKING CHANGE: user ID is now a UUID instead of integer',
        breaking: true,
      });
    });

    it('parses complex scope names', () => {
      const result = parseConventionalCommit('fix(user-auth): handle edge case');

      expect(result).toEqual({
        type: 'fix',
        scope: 'user-auth',
        description: 'handle edge case',
        breaking: false,
      });
    });

    it('parses various commit types', () => {
      const types = [
        'feat', 'fix', 'docs', 'style', 'refactor',
        'perf', 'test', 'build', 'ci', 'chore', 'revert'
      ];

      types.forEach(type => {
        const result = parseConventionalCommit(`${type}: do something`);
        expect(result?.type).toBe(type);
        expect(result?.breaking).toBe(false);
      });
    });

    it('handles whitespace correctly', () => {
      const result = parseConventionalCommit('feat:   add feature with extra spaces   ');

      expect(result).toEqual({
        type: 'feat',
        description: 'add feature with extra spaces',
        breaking: false,
      });
    });

    it('handles multiline body with extra whitespace', () => {
      const message = 'feat: new feature\n\n  \n  This is the body\n  with multiple lines  \n  \n';
      const result = parseConventionalCommit(message);

      expect(result?.body).toBe('This is the body\n  with multiple lines');
    });

    it('returns null for invalid commit messages', () => {
      const invalidMessages = [
        '',
        'just a regular commit message',
        'feat add feature', // Missing colon
        'feat:', // Missing description
        'FEAT: uppercase type',
        '123: numeric type',
        'feat (invalid-scope): wrong scope format',
      ];

      invalidMessages.forEach(message => {
        expect(parseConventionalCommit(message)).toBeNull();
      });
    });

    it('handles edge cases in scope', () => {
      // Valid scopes
      expect(parseConventionalCommit('feat(a): test')?.scope).toBe('a');
      expect(parseConventionalCommit('feat(api-v2): test')?.scope).toBe('api-v2');
      expect(parseConventionalCommit('feat(user_management): test')?.scope).toBe('user_management');

      // Invalid scope should still parse (scope is optional)
      expect(parseConventionalCommit('feat(): test')).toBeNull(); // Empty scope
    });

    it('handles various description formats', () => {
      expect(parseConventionalCommit('feat: add feature')?.description).toBe('add feature');
      expect(parseConventionalCommit('feat: Add Feature')?.description).toBe('Add Feature');
      expect(parseConventionalCommit('feat: add-feature-with-dashes')?.description).toBe('add-feature-with-dashes');
    });
  });

  describe('createConventionalCommit', () => {
    it('creates basic commit messages', () => {
      const result = createConventionalCommit('feat', 'add new feature');

      expect(result).toBe('feat: add new feature');
    });

    it('creates commit messages with scope', () => {
      const result = createConventionalCommit('fix', 'resolve bug', {
        scope: 'auth',
      });

      expect(result).toBe('fix(auth): resolve bug');
    });

    it('creates commit messages with body', () => {
      const result = createConventionalCommit('feat', 'add authentication', {
        body: 'Implements OAuth 2.0 flow with multiple providers',
      });

      expect(result).toBe('feat: add authentication\n\nImplements OAuth 2.0 flow with multiple providers');
    });

    it('creates breaking change commit with exclamation mark', () => {
      const result = createConventionalCommit('refactor', 'change API format', {
        breaking: true,
      });

      expect(result).toBe('refactor!: change API format');
    });

    it('creates commit with scope and breaking change', () => {
      const result = createConventionalCommit('feat', 'update user model', {
        scope: 'api',
        breaking: true,
      });

      expect(result).toBe('feat(api)!: update user model');
    });

    it('creates complete commit with all options', () => {
      const result = createConventionalCommit('feat', 'add dark mode', {
        scope: 'ui',
        body: 'Includes automatic system preference detection and manual toggle',
        breaking: false,
      });

      expect(result).toBe(
        'feat(ui): add dark mode\n\nIncludes automatic system preference detection and manual toggle'
      );
    });

    it('creates breaking change with body', () => {
      const result = createConventionalCommit('refactor', 'update API', {
        breaking: true,
        body: 'BREAKING CHANGE: API endpoints now require authentication',
      });

      expect(result).toBe(
        'refactor!: update API\n\nBREAKING CHANGE: API endpoints now require authentication'
      );
    });

    it('handles empty and undefined options', () => {
      const result1 = createConventionalCommit('docs', 'update README');
      const result2 = createConventionalCommit('docs', 'update README', {});
      const result3 = createConventionalCommit('docs', 'update README', undefined);

      expect(result1).toBe('docs: update README');
      expect(result2).toBe('docs: update README');
      expect(result3).toBe('docs: update README');
    });

    it('ignores undefined properties in options', () => {
      const result = createConventionalCommit('test', 'add unit tests', {
        scope: undefined,
        body: undefined,
        breaking: undefined,
      });

      expect(result).toBe('test: add unit tests');
    });
  });

  describe('COMMIT_TYPES constant', () => {
    it('contains all standard conventional commit types', () => {
      const expectedTypes = [
        'feat', 'fix', 'docs', 'style', 'refactor',
        'perf', 'test', 'build', 'ci', 'chore', 'revert'
      ];

      expectedTypes.forEach(type => {
        expect(COMMIT_TYPES[type as CommitType]).toBeDefined();
        expect(COMMIT_TYPES[type as CommitType].title).toBeTruthy();
        expect(COMMIT_TYPES[type as CommitType].emoji).toBeTruthy();
        expect(COMMIT_TYPES[type as CommitType].description).toBeTruthy();
      });
    });

    it('has proper structure for each commit type', () => {
      Object.values(COMMIT_TYPES).forEach(typeInfo => {
        expect(typeof typeInfo.title).toBe('string');
        expect(typeof typeInfo.emoji).toBe('string');
        expect(typeof typeInfo.description).toBe('string');
        expect(typeInfo.title.length).toBeGreaterThan(0);
        expect(typeInfo.description.length).toBeGreaterThan(0);
      });
    });

    it('has unique titles and descriptions', () => {
      const titles = Object.values(COMMIT_TYPES).map(t => t.title);
      const descriptions = Object.values(COMMIT_TYPES).map(t => t.description);

      expect(new Set(titles).size).toBe(titles.length);
      expect(new Set(descriptions).size).toBe(descriptions.length);
    });

    it('contains expected content for specific types', () => {
      expect(COMMIT_TYPES.feat.title).toBe('Features');
      expect(COMMIT_TYPES.feat.emoji).toBe('✨');
      expect(COMMIT_TYPES.feat.description).toBe('New features');

      expect(COMMIT_TYPES.fix.title).toBe('Bug Fixes');
      expect(COMMIT_TYPES.fix.emoji).toBe('🐛');
      expect(COMMIT_TYPES.fix.description).toBe('Bug fixes');

      expect(COMMIT_TYPES.docs.title).toBe('Documentation');
      expect(COMMIT_TYPES.docs.emoji).toBe('📚');
    });
  });

  describe('suggestCommitType', () => {
    it('suggests test type for test files', () => {
      const testFiles = [
        'src/auth.test.ts',
        'src/utils.spec.js',
        '__tests__/helpers.js',
        'tests/integration.test.ts',
      ];

      testFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('test');
      });
    });

    it('suggests docs type for documentation files', () => {
      const docFiles = [
        'README.md',
        'CHANGELOG.md',
        'docs/api.md',
        'docs/installation.md',
        'CONTRIBUTING.md',
      ];

      docFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('docs');
      });
    });

    it('suggests style type for style files', () => {
      const styleFiles = [
        'src/styles.css',
        'components/Button.scss',
        'themes/dark.less',
        'Button.styled.ts',
      ];

      styleFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('style');
      });
    });

    it('suggests build type for build files', () => {
      const buildFiles = [
        'package.json',
        'yarn.lock',
        'package-lock.json',
      ];

      buildFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('build');
      });
    });

    it('suggests ci type for CI files', () => {
      const ciFiles = [
        '.github/workflows/ci.yml',
        '.gitlab-ci.yml',
        '.circleci/config.yml',
        'Jenkinsfile',
      ];

      ciFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('ci');
      });
    });

    it('suggests chore type for configuration files', () => {
      const configFiles = [
        '.eslintrc.json',
        '.prettierrc',
        '.editorconfig',
        'tsconfig.json',
      ];

      configFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('chore');
      });
    });

    it('suggests feat for source files by default', () => {
      const sourceFiles = [
        'src/auth.ts',
        'components/Button.tsx',
        'lib/utils.js',
        'index.ts',
      ];

      sourceFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('feat');
      });
    });

    it('suggests chore for files without clear pattern', () => {
      const miscFiles = [
        'some/random/file.txt',
        'data.json',
        'config/settings.xml',
      ];

      miscFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('chore');
      });
    });

    it('handles mixed file types by choosing most common', () => {
      const mixedFiles = [
        'src/auth.test.ts',
        'src/login.test.ts',
        'src/utils.test.ts',
        'src/api.ts', // Only one source file
      ];

      expect(suggestCommitType(mixedFiles)).toBe('test');
    });

    it('handles build files with higher priority', () => {
      const mixedFiles = [
        'src/auth.ts',
        'src/utils.ts',
        'package.json', // Build file should take priority
      ];

      expect(suggestCommitType(mixedFiles)).toBe('build');
    });

    it('suggests feat for new files without extension pattern', () => {
      const newFiles = [
        'new-feature',
        'some-module',
      ];

      newFiles.forEach(file => {
        expect(suggestCommitType([file])).toBe('feat');
      });
    });

    it('handles empty file list', () => {
      expect(suggestCommitType([])).toBe('feat');
    });

    it('handles files with multiple patterns by priority', () => {
      const files = [
        'src/auth.test.ts', // test pattern
        'docs/api.md', // docs pattern
        'package.json', // build pattern
        '.github/workflows/ci.yml', // ci pattern
      ];

      // Each pattern should match 1 file, but test comes first in the loop
      expect(suggestCommitType(files)).toBe('test');
    });

    describe('pattern matching specifics', () => {
      it('matches test patterns correctly', () => {
        expect(suggestCommitType(['auth.test.js'])).toBe('test');
        expect(suggestCommitType(['auth.spec.js'])).toBe('test');
        expect(suggestCommitType(['__tests__/auth.js'])).toBe('test');
        expect(suggestCommitType(['tests/auth.js'])).toBe('test');
        expect(suggestCommitType(['test/auth.js'])).toBe('test');
      });

      it('matches documentation patterns correctly', () => {
        expect(suggestCommitType(['readme.md'])).toBe('docs');
        expect(suggestCommitType(['README.MD'])).toBe('docs');
        expect(suggestCommitType(['docs/guide.md'])).toBe('docs');
        expect(suggestCommitType(['DOCS/GUIDE.MD'])).toBe('docs');
      });

      it('matches style patterns correctly', () => {
        expect(suggestCommitType(['style.css'])).toBe('style');
        expect(suggestCommitType(['theme.scss'])).toBe('style');
        expect(suggestCommitType(['variables.less'])).toBe('style');
        expect(suggestCommitType(['Component.styled.ts'])).toBe('style');
      });

      it('matches build patterns correctly', () => {
        expect(suggestCommitType(['package.json'])).toBe('build');
        expect(suggestCommitType(['PACKAGE.JSON'])).toBe('build');
        expect(suggestCommitType(['yarn.lock'])).toBe('build');
        expect(suggestCommitType(['package-lock.json'])).toBe('build');
      });

      it('matches CI patterns case-insensitively', () => {
        expect(suggestCommitType(['.GITHUB/workflows/test.yml'])).toBe('ci');
        expect(suggestCommitType(['.GITLAB-CI.yml'])).toBe('ci');
        expect(suggestCommitType(['.CIRCLECI/config.yml'])).toBe('ci');
        expect(suggestCommitType(['JENKINSFILE'])).toBe('ci');
      });

      it('matches chore patterns correctly', () => {
        expect(suggestCommitType(['.eslintrc'])).toBe('chore');
        expect(suggestCommitType(['.prettierrc.json'])).toBe('chore');
        expect(suggestCommitType(['.editorconfig'])).toBe('chore');
        expect(suggestCommitType(['tsconfig.json'])).toBe('chore');
        expect(suggestCommitType(['TSCONFIG.JSON'])).toBe('chore');
      });
    });
  });

  describe('Integration tests', () => {
    it('round-trip parsing and creation works correctly', () => {
      const original = 'feat(auth): add OAuth support\n\nImplements Google and GitHub providers';
      const parsed = parseConventionalCommit(original);

      expect(parsed).toBeTruthy();

      const recreated = createConventionalCommit(parsed!.type, parsed!.description, {
        scope: parsed!.scope,
        body: parsed!.body,
        breaking: parsed!.breaking,
      });

      expect(recreated).toBe(original);
    });

    it('handles breaking changes correctly in round-trip', () => {
      const original = 'refactor(api)!: change response format\n\nBREAKING CHANGE: all responses now wrapped in data field';
      const parsed = parseConventionalCommit(original);

      expect(parsed).toBeTruthy();
      expect(parsed!.breaking).toBe(true);

      const recreated = createConventionalCommit(parsed!.type, parsed!.description, {
        scope: parsed!.scope,
        body: parsed!.body,
        breaking: parsed!.breaking,
      });

      expect(recreated).toBe(original);
    });

    it('suggests appropriate types for typical development scenarios', () => {
      const scenarios = [
        {
          files: ['src/auth.ts', 'src/login.tsx'],
          expected: 'feat',
          description: 'New feature files'
        },
        {
          files: ['src/auth.test.ts', 'src/login.test.tsx'],
          expected: 'test',
          description: 'Test files'
        },
        {
          files: ['README.md', 'API.md'],
          expected: 'docs',
          description: 'Documentation files'
        },
        {
          files: ['package.json'],
          expected: 'build',
          description: 'Package configuration'
        },
        {
          files: ['.github/workflows/ci.yml'],
          expected: 'ci',
          description: 'CI configuration'
        },
      ];

      scenarios.forEach(({ files, expected, description }) => {
        expect(suggestCommitType(files)).toBe(expected);
      });
    });

    it('integrates with COMMIT_TYPES for metadata', () => {
      const commitType = suggestCommitType(['src/auth.test.ts']);
      const typeInfo = COMMIT_TYPES[commitType];

      expect(typeInfo).toBeDefined();
      expect(typeInfo.title).toBe('Tests');
      expect(typeInfo.emoji).toBe('🧪');
      expect(typeInfo.description).toBe('Test additions/changes');
    });

    it('works with real project file patterns', () => {
      const projectFiles = [
        'src/components/Button.tsx',
        'src/hooks/useAuth.ts',
        'src/utils/helpers.ts',
        'src/__tests__/Button.test.tsx',
        'docs/getting-started.md',
        'package.json',
        '.github/workflows/test.yml',
        'src/styles/theme.css',
      ];

      // Test individual suggestions
      expect(suggestCommitType(['src/components/Button.tsx'])).toBe('feat');
      expect(suggestCommitType(['src/__tests__/Button.test.tsx'])).toBe('test');
      expect(suggestCommitType(['docs/getting-started.md'])).toBe('docs');
      expect(suggestCommitType(['package.json'])).toBe('build');
      expect(suggestCommitType(['.github/workflows/test.yml'])).toBe('ci');
      expect(suggestCommitType(['src/styles/theme.css'])).toBe('style');

      // Test mixed file types
      expect(suggestCommitType(projectFiles)).toBe('test'); // First pattern found
    });
  });
});