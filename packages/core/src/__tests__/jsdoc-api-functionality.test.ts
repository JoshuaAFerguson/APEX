/**
 * @fileoverview Tests for API functionality documented with JSDoc
 * Verifies that documented APIs work as described in their JSDoc examples
 */

import {
  generateTaskId,
  generateIdleTaskId,
  generateTaskTemplateId,
  generateApprovalId,
  slugify,
  generateBranchName,
  calculateCost,
  formatDuration,
  formatElapsed,
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
  retry,
  createDeferred,
  truncate,
  extractCodeBlocks,
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  suggestCommitType,
  truncateToolOutput
} from '../utils';

import {
  getPlatformShell,
  isWindows,
  getKillCommand,
  resolveExecutable,
  createShellCommand,
  createEnvironmentConfig,
  PATH_SEPARATOR,
  LINE_ENDING,
  SHELL_CONSTANTS
} from '../shell-utils';

describe('Utils API Functionality Tests', () => {
  describe('ID Generation Functions', () => {
    test('generateTaskId should create unique task IDs', () => {
      const id1 = generateTaskId();
      const id2 = generateTaskId();

      expect(id1).toMatch(/^task_[a-z0-9]+_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^task_[a-z0-9]+_[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });

    test('generateIdleTaskId should create unique idle task IDs', () => {
      const id1 = generateIdleTaskId();
      const id2 = generateIdleTaskId();

      expect(id1).toMatch(/^idle_[a-z0-9]+_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^idle_[a-z0-9]+_[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });

    test('generateTaskTemplateId should create unique template IDs', () => {
      const id = generateTaskTemplateId();
      expect(id).toMatch(/^template_[a-z0-9]+_[a-f0-9]{8}$/);
    });

    test('generateApprovalId should create unique approval IDs', () => {
      const id = generateApprovalId();
      expect(id).toMatch(/^apr_[a-z0-9]+_[a-f0-9]{8}$/);
    });
  });

  describe('String Utilities', () => {
    test('slugify should convert strings to URL-friendly slugs', () => {
      expect(slugify('Hello World! This is a Test')).toBe('hello-world-this-is-a-test');
      expect(slugify('Special@Characters#Here')).toBe('specialcharactershere');
      expect(slugify('   spaces   around   ')).toBe('spaces-around');

      // Test max length
      const longString = 'A very long title that definitely exceeds the maximum length limit for slugs';
      expect(slugify(longString)).toHaveLength(50);
    });

    test('generateBranchName should create valid Git branch names', () => {
      const branch = generateBranchName('feature/', 'task_lx2k4m_a1b2c3d4', 'Add user authentication');
      expect(branch).toMatch(/^feature\/lx2k4m-add-user-authentication$/);

      const bugfixBranch = generateBranchName('bugfix/', 'bug_123', 'Fix login issue');
      expect(bugfixBranch).toMatch(/^bugfix\/bug_123-fix-login-issue$/);
    });

    test('truncate should handle string truncation', () => {
      const longText = 'This is a very long string that needs truncation';
      expect(truncate(longText, 20)).toBe('This is a very lo...');
      expect(truncate(longText, 20, ' [more]')).toBe('This is a [more]');

      const shortText = 'Short text';
      expect(truncate(shortText, 20)).toBe('Short text');
    });
  });

  describe('Cost and Duration Formatting', () => {
    test('calculateCost should compute costs correctly', () => {
      // Based on Sonnet 4 pricing: $3/1M input, $15/1M output
      expect(calculateCost(1000, 500)).toBe(0.0105);
      expect(calculateCost(50000, 25000)).toBe(0.525);
      expect(calculateCost(0, 0)).toBe(0);
    });

    test('formatDuration should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(2500)).toBe('2.5s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(7800000)).toBe('2h 10m');
    });

    test('formatElapsed should format elapsed time', () => {
      const start = new Date('2024-01-01T10:00:00Z');
      const current = new Date('2024-01-01T10:02:30Z');
      expect(formatElapsed(start, current)).toBe('2m 30s');

      // Test with sub-second duration
      const recentStart = new Date(Date.now() - 500);
      expect(formatElapsed(recentStart)).toBe('0s');

      // Test edge cases
      expect(formatElapsed(new Date(0), new Date(1000))).toBe('0s');
      expect(formatElapsed(new Date('invalid'), new Date())).toBe('0s');
    });

    test('formatTokens should add thousands separators', () => {
      expect(formatTokens(1234)).toBe('1,234');
      expect(formatTokens(1000000)).toBe('1,000,000');
      expect(formatTokens(42)).toBe('42');
    });

    test('formatCost should format USD currency', () => {
      expect(formatCost(0.1234)).toBe('$0.1234');
      expect(formatCost(1.5)).toBe('$1.5000');
      expect(formatCost(25)).toBe('$25.0000');
    });
  });

  describe('Semantic Versioning', () => {
    test('parseSemver should parse version strings', () => {
      const version = parseSemver('1.2.3-alpha.1+build.123');
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: ['alpha', '1'],
        build: ['build', '123'],
        raw: '1.2.3-alpha.1+build.123'
      });

      const simple = parseSemver('v2.0.0');
      expect(simple?.major).toBe(2);
      expect(simple?.minor).toBe(0);
      expect(simple?.patch).toBe(0);
      expect(simple?.raw).toBe('v2.0.0');

      expect(parseSemver('not.a.version')).toBeNull();
    });

    test('isPreRelease should detect prerelease versions', () => {
      expect(isPreRelease('1.0.0-alpha.1')).toBe(true);
      expect(isPreRelease('1.0.0-beta')).toBe(true);
      expect(isPreRelease('1.0.0')).toBe(false);
      expect(isPreRelease('2.1.3+build.456')).toBe(false);

      const parsed = parseSemver('1.0.0-rc.1');
      expect(isPreRelease(parsed!)).toBe(true);
    });

    test('compareVersions should handle version comparison', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);

      // Prerelease handling
      expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);

      // Invalid versions
      expect(compareVersions('invalid', '1.0.0')).toBe(-1);
    });

    test('getUpdateType should determine update types', () => {
      expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
      expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
      expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
      expect(getUpdateType('1.0.0', '1.0.0-beta')).toBe('downgrade');
      expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
      expect(getUpdateType('1.0.0', '1.0.0')).toBe('none');

      const current = parseSemver('1.2.3');
      const latest = parseSemver('1.3.0');
      expect(getUpdateType(current!, latest!)).toBe('minor');
    });
  });

  describe('Conventional Commits', () => {
    test('parseConventionalCommit should parse commit messages', () => {
      const commit = parseConventionalCommit('feat(auth): add user login');
      expect(commit).toEqual({
        type: 'feat',
        scope: 'auth',
        description: 'add user login',
        breaking: false,
        body: undefined
      });

      const breaking = parseConventionalCommit('feat!: major API change\n\nThis is a breaking change');
      expect(breaking).toEqual({
        type: 'feat',
        scope: undefined,
        description: 'major API change',
        body: 'This is a breaking change',
        breaking: true
      });

      expect(parseConventionalCommit('invalid message')).toBeNull();
    });

    test('createConventionalCommit should format commit messages', () => {
      const commit = createConventionalCommit('feat', 'add user login', {
        scope: 'auth',
        body: 'Implements OAuth 2.0 authentication flow'
      });
      expect(commit).toBe('feat(auth): add user login\n\nImplements OAuth 2.0 authentication flow');

      const breaking = createConventionalCommit('feat', 'remove deprecated API', {
        breaking: true,
        body: 'BREAKING CHANGE: Old API endpoints no longer supported'
      });
      expect(breaking).toBe('feat!: remove deprecated API\n\nBREAKING CHANGE: Old API endpoints no longer supported');
    });

    test('suggestCommitType should suggest commit types based on files', () => {
      expect(suggestCommitType(['src/utils.test.ts', 'src/api.spec.js'])).toBe('test');
      expect(suggestCommitType(['README.md', 'docs/api.md'])).toBe('docs');
      expect(suggestCommitType(['package.json'])).toBe('build');
      expect(suggestCommitType(['src/newComponent.tsx'])).toBe('feat');
    });
  });

  describe('Utility Functions', () => {
    test('safeJsonParse should handle JSON parsing safely', () => {
      const validJson = safeJsonParse('{"name": "John"}', {});
      expect(validJson).toEqual({ name: 'John' });

      const invalidJson = safeJsonParse('invalid json', { default: true });
      expect(invalidJson).toEqual({ default: true });

      const arrayFallback = safeJsonParse('malformed', []);
      expect(arrayFallback).toEqual([]);
    });

    test('deepMerge should merge objects deeply', () => {
      const target = { a: 1, b: { x: 1, y: 2 }, c: 'original' };
      const source = { b: { y: 3, z: 4 }, d: 'new' };

      const merged = deepMerge(target, source);
      expect(merged).toEqual({
        a: 1,
        b: { x: 1, y: 3, z: 4 },
        c: 'original',
        d: 'new'
      });

      // Arrays should be replaced
      const config = { items: [1, 2] };
      const update = { items: [3, 4, 5] };
      const result = deepMerge(config, update);
      expect(result.items).toEqual([3, 4, 5]);
    });

    test('createDeferred should create deferred promises', async () => {
      const deferred = createDeferred<string>();

      // Resolve after a delay
      setTimeout(() => {
        deferred.resolve('Hello World');
      }, 10);

      const result = await deferred.promise;
      expect(result).toBe('Hello World');
    });

    test('retry should handle retries with exponential backoff', async () => {
      let attempts = 0;
      const mockFn = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return 'success';
      });

      const result = await retry(mockFn, { maxAttempts: 5, initialDelay: 1 });
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('extractCodeBlocks should extract code from markdown', () => {
      const markdown = `
Here is some JavaScript:
\`\`\`javascript
console.log('Hello World');
\`\`\`

And some Python:
\`\`\`python
print("Hello World")
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toEqual([
        { language: 'javascript', code: "console.log('Hello World');" },
        { language: 'python', code: 'print("Hello World")' }
      ]);
    });
  });

  describe('Git Conflict Detection', () => {
    test('detectConflicts should parse Git conflict markers', () => {
      const conflictedContent = `
function hello() {
<<<<<<< HEAD
  console.log('Hello from main');
=======
  console.log('Hello from feature');
>>>>>>> feature-branch
}
      `;

      const conflicts = detectConflicts(conflictedContent, 'src/hello.js');
      expect(conflicts).not.toBeNull();
      expect(conflicts!.conflictMarkers).toHaveLength(1);
      expect(conflicts!.baseBranch).toBe('HEAD');
      expect(conflicts!.incomingBranch).toBe('feature-branch');
    });

    test('suggestConflictResolution should provide resolution suggestions', () => {
      const marker = {
        startLine: 5,
        endLine: 9,
        currentContent: 'console.log("Hello");',
        incomingContent: 'console.log("Hello"); // Added comment'
      };

      const suggestions = suggestConflictResolution(marker);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === 'keep-incoming')).toBe(true);
      expect(suggestions.some(s => s.type === 'manual')).toBe(true);
    });

    test('formatConflictReport should format conflict information', () => {
      const conflicts = [{
        file: 'src/main.js',
        baseBranch: 'main',
        incomingBranch: 'feature',
        conflictMarkers: [{
          startLine: 5,
          endLine: 10,
          currentContent: 'old code',
          incomingContent: 'new code'
        }]
      }];

      const report = formatConflictReport(conflicts);
      expect(report).toContain('Found 1 file(s) with conflicts');
      expect(report).toContain('src/main.js');
      expect(report).toContain('main ← feature');
    });
  });

  describe('Tool Output Truncation', () => {
    test('truncateToolOutput should truncate long content', () => {
      const longOutput = 'x'.repeat(15000);
      const result = truncateToolOutput(longOutput, { maxLength: 1000 });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(1000);
      expect(result.originalLength).toBe(15000);
    });

    test('truncateToolOutput should handle JSON content', () => {
      const jsonOutput = JSON.stringify({
        data: Array(100).fill({ name: 'test', value: 123 })
      });

      const result = truncateToolOutput(jsonOutput, {
        maxLength: 500,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output.replace(/... \[truncated\]$/, ''))).not.toThrow();
    });
  });
});

describe('Shell Utils API Functionality Tests', () => {
  describe('Platform Detection', () => {
    test('isWindows should return boolean', () => {
      const result = isWindows();
      expect(typeof result).toBe('boolean');
    });

    test('getPlatformShell should return shell config', () => {
      const shellConfig = getPlatformShell();
      expect(shellConfig).toHaveProperty('shell');
      expect(shellConfig).toHaveProperty('shellArgs');
      expect(typeof shellConfig.shell).toBe('string');
      expect(Array.isArray(shellConfig.shellArgs)).toBe(true);
    });
  });

  describe('Process Management', () => {
    test('getKillCommand should generate kill commands', () => {
      const killCmd = getKillCommand(1234);
      expect(Array.isArray(killCmd)).toBe(true);
      expect(killCmd.length).toBeGreaterThan(1);

      if (isWindows()) {
        expect(killCmd).toEqual(['taskkill', '/f', '/pid', '1234']);
      } else {
        expect(killCmd).toEqual(['kill', '-9', '1234']);
      }
    });

    test('getKillCommand should validate PID', () => {
      expect(() => getKillCommand(-1)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(0)).toThrow('PID must be a positive integer');
      expect(() => getKillCommand(1.5)).toThrow('PID must be a positive integer');
    });
  });

  describe('Executable Resolution', () => {
    test('resolveExecutable should handle executable names', () => {
      if (isWindows()) {
        expect(resolveExecutable('node')).toBe('node.exe');
        expect(resolveExecutable('git.exe')).toBe('git.exe');
      } else {
        expect(resolveExecutable('node')).toBe('node');
        expect(resolveExecutable('git')).toBe('git');
      }
    });

    test('resolveExecutable should validate input', () => {
      expect(() => resolveExecutable('')).toThrow('Executable name must be a non-empty string');
      expect(() => resolveExecutable('   ')).toThrow('Executable name must be a non-empty string');
    });
  });

  describe('Command Creation', () => {
    test('createShellCommand should join command parts', () => {
      const command = createShellCommand(['git', 'commit', '-m', 'test message']);
      expect(typeof command).toBe('string');
      expect(command).toContain('git');
      expect(command).toContain('commit');
    });

    test('createShellCommand should handle special characters', () => {
      const command = createShellCommand(['echo', 'hello world']);
      if (isWindows()) {
        expect(command).toBe('echo "hello world"');
      } else {
        expect(command).toBe("echo 'hello world'");
      }
    });

    test('createShellCommand should validate input', () => {
      expect(() => createShellCommand([])).toThrow('Command parts must be a non-empty array');
      expect(() => createShellCommand(['valid', null as any])).toThrow('must be a string');
    });
  });

  describe('Environment Configuration', () => {
    test('createEnvironmentConfig should handle default options', () => {
      const env = createEnvironmentConfig();
      expect(typeof env).toBe('object');
      expect(env.PATH || env.Path).toBeDefined(); // PATH should be inherited
    });

    test('createEnvironmentConfig should merge custom variables', () => {
      const env = createEnvironmentConfig({
        env: { CUSTOM_VAR: 'test' },
        inheritEnv: true
      });
      expect(env.CUSTOM_VAR).toBe('test');
      expect(env.PATH || env.Path).toBeDefined();
    });

    test('createEnvironmentConfig should handle no inheritance', () => {
      const env = createEnvironmentConfig({
        env: { CUSTOM_VAR: 'test' },
        inheritEnv: false
      });
      expect(env.CUSTOM_VAR).toBe('test');
      expect(Object.keys(env)).toEqual(['CUSTOM_VAR']);
    });
  });

  describe('Constants', () => {
    test('PATH_SEPARATOR should be platform appropriate', () => {
      if (isWindows()) {
        expect(PATH_SEPARATOR).toBe(';');
      } else {
        expect(PATH_SEPARATOR).toBe(':');
      }
    });

    test('LINE_ENDING should be platform appropriate', () => {
      if (isWindows()) {
        expect(LINE_ENDING).toBe('\r\n');
      } else {
        expect(LINE_ENDING).toBe('\n');
      }
    });

    test('SHELL_CONSTANTS should contain expected values', () => {
      expect(SHELL_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000);
      expect(SHELL_CONSTANTS.MAX_BUFFER).toBe(1024 * 1024);
      expect(SHELL_CONSTANTS.PATH_SEPARATOR).toBe(PATH_SEPARATOR);
      expect(SHELL_CONSTANTS.LINE_ENDING).toBe(LINE_ENDING);
    });
  });
});