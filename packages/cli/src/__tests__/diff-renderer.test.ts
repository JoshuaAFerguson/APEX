import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import { renderColoredDiff } from '../diff-renderer.js';

describe('renderColoredDiff', () => {
  // Basic functionality tests
  describe('basic functionality', () => {
    it('should colorize added lines green', () => {
      const diff = '+added line';
      const result = renderColoredDiff(diff);
      expect(result).toBe(chalk.green('+added line'));
    });

    it('should colorize removed lines red', () => {
      const diff = '-removed line';
      const result = renderColoredDiff(diff);
      expect(result).toBe(chalk.red('-removed line'));
    });

    it('should colorize hunk headers cyan', () => {
      const diff = '@@ -1,3 +1,4 @@';
      const result = renderColoredDiff(diff);
      expect(result).toBe(chalk.cyan('@@ -1,3 +1,4 @@'));
    });

    it('should colorize diff --git headers bold', () => {
      const diff = 'diff --git a/file.txt b/file.txt';
      const result = renderColoredDiff(diff);
      expect(result).toBe(chalk.bold('diff --git a/file.txt b/file.txt'));
    });

    it('should colorize file headers bold', () => {
      const diff1 = '--- a/file.txt';
      const diff2 = '+++ b/file.txt';
      const result1 = renderColoredDiff(diff1);
      const result2 = renderColoredDiff(diff2);

      expect(result1).toBe(chalk.bold('--- a/file.txt'));
      expect(result2).toBe(chalk.bold('+++ b/file.txt'));
    });

    it('should colorize index lines gray', () => {
      const diff = 'index 1234567..abcdefg 100644';
      const result = renderColoredDiff(diff);
      expect(result).toBe(chalk.gray('index 1234567..abcdefg 100644'));
    });

    it('should leave context lines unstyled', () => {
      const diff = ' context line';
      const result = renderColoredDiff(diff);
      expect(result).toBe(' context line');
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(renderColoredDiff('')).toBe('');
      expect(renderColoredDiff('   ')).toBe('');
    });

    it('should handle null/undefined input gracefully', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(renderColoredDiff(null)).toBe('');
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(renderColoredDiff(undefined)).toBe('');
    });

    it('should handle single line diffs', () => {
      expect(renderColoredDiff('+single added line')).toBe(chalk.green('+single added line'));
      expect(renderColoredDiff('-single removed line')).toBe(chalk.red('-single removed line'));
    });

    it('should handle Windows line endings', () => {
      const diff = '+added line\r\n-removed line';
      const result = renderColoredDiff(diff);
      const expected = chalk.green('+added line') + '\n' + chalk.red('-removed line');
      expect(result).toBe(expected);
    });

    it('should handle mixed line endings', () => {
      const diff = '+added line\r\n-removed line\n context line';
      const result = renderColoredDiff(diff);
      const expected = chalk.green('+added line') + '\n' + chalk.red('-removed line') + '\n context line';
      expect(result).toBe(expected);
    });

    it('should handle lines that start with target prefixes but are not actual diff content', () => {
      const diff = 'This line says +something but is not a diff line';
      const result = renderColoredDiff(diff);
      expect(result).toBe('This line says +something but is not a diff line');
    });
  });

  // Multiple file changes and complex scenarios
  describe('multiple file changes', () => {
    it('should handle multiple files in single diff', () => {
      const diff = [
        'diff --git a/file1.txt b/file1.txt',
        'index 1111111..2222222 100644',
        '--- a/file1.txt',
        '+++ b/file1.txt',
        '@@ -1,2 +1,2 @@',
        '-old content file1',
        '+new content file1',
        'diff --git a/file2.js b/file2.js',
        'index 3333333..4444444 100644',
        '--- a/file2.js',
        '+++ b/file2.js',
        '@@ -5,3 +5,4 @@',
        ' function test() {',
        '-  return false;',
        '+  return true;',
        '+  // Added comment',
        ' }'
      ].join('\n');

      const result = renderColoredDiff(diff);

      // Verify each file's headers are bold
      expect(result).toContain(chalk.bold('diff --git a/file1.txt b/file1.txt'));
      expect(result).toContain(chalk.bold('diff --git a/file2.js b/file2.js'));
      expect(result).toContain(chalk.bold('--- a/file1.txt'));
      expect(result).toContain(chalk.bold('--- a/file2.js'));
      expect(result).toContain(chalk.bold('+++ b/file1.txt'));
      expect(result).toContain(chalk.bold('+++ b/file2.js'));

      // Verify hunks are cyan
      expect(result).toContain(chalk.cyan('@@ -1,2 +1,2 @@'));
      expect(result).toContain(chalk.cyan('@@ -5,3 +5,4 @@'));

      // Verify additions/removals
      expect(result).toContain(chalk.red('-old content file1'));
      expect(result).toContain(chalk.green('+new content file1'));
      expect(result).toContain(chalk.red('-  return false;'));
      expect(result).toContain(chalk.green('+  return true;'));
      expect(result).toContain(chalk.green('+  // Added comment'));
    });

    it('should handle binary file notifications', () => {
      const diff = [
        'diff --git a/image.png b/image.png',
        'index 1234567..abcdefg 100644',
        'Binary files a/image.png and b/image.png differ'
      ].join('\n');

      const result = renderColoredDiff(diff);
      expect(result).toContain(chalk.bold('diff --git a/image.png b/image.png'));
      expect(result).toContain(chalk.gray('index 1234567..abcdefg 100644'));
      expect(result).toContain('Binary files a/image.png and b/image.png differ');
    });
  });

  // Complex multi-line scenarios
  describe('complex multi-line scenarios', () => {
    it('should handle mixed content correctly', () => {
      const diff = [
        'diff --git a/file.txt b/file.txt',
        'index 1234567..abcdefg 100644',
        '--- a/file.txt',
        '+++ b/file.txt',
        '@@ -1,3 +1,4 @@',
        ' context line',
        '-removed line',
        '+added line',
        ' another context line'
      ].join('\n');

      const result = renderColoredDiff(diff);
      const expectedLines = [
        chalk.bold('diff --git a/file.txt b/file.txt'),
        chalk.gray('index 1234567..abcdefg 100644'),
        chalk.bold('--- a/file.txt'),
        chalk.bold('+++ b/file.txt'),
        chalk.cyan('@@ -1,3 +1,4 @@'),
        ' context line',
        chalk.red('-removed line'),
        chalk.green('+added line'),
        ' another context line'
      ];

      expect(result).toBe(expectedLines.join('\n'));
    });

    it('should handle multiple hunks', () => {
      const diff = [
        '@@ -1,3 +1,3 @@',
        ' line 1',
        '-old line 2',
        '+new line 2',
        ' line 3',
        '@@ -10,2 +10,3 @@',
        ' line 10',
        '+new line 11',
        ' line 12'
      ].join('\n');

      const result = renderColoredDiff(diff);
      const expectedLines = [
        chalk.cyan('@@ -1,3 +1,3 @@'),
        ' line 1',
        chalk.red('-old line 2'),
        chalk.green('+new line 2'),
        ' line 3',
        chalk.cyan('@@ -10,2 +10,3 @@'),
        ' line 10',
        chalk.green('+new line 11'),
        ' line 12'
      ];

      expect(result).toBe(expectedLines.join('\n'));
    });

    it('should handle real git diff output', () => {
      const gitDiff = [
        'diff --git a/src/example.js b/src/example.js',
        'index 83db48f..84d55c5 100644',
        '--- a/src/example.js',
        '+++ b/src/example.js',
        '@@ -1,7 +1,8 @@',
        ' function example() {',
        '-  console.log("old");',
        '+  console.log("new");',
        '+  console.log("additional");',
        '   return true;',
        ' }'
      ].join('\n');

      const result = renderColoredDiff(gitDiff);

      // Verify the structure is correct
      expect(result).toContain(chalk.bold('diff --git a/src/example.js b/src/example.js'));
      expect(result).toContain(chalk.gray('index 83db48f..84d55c5 100644'));
      expect(result).toContain(chalk.bold('--- a/src/example.js'));
      expect(result).toContain(chalk.bold('+++ b/src/example.js'));
      expect(result).toContain(chalk.cyan('@@ -1,7 +1,8 @@'));
      expect(result).toContain(chalk.red('-  console.log("old");'));
      expect(result).toContain(chalk.green('+  console.log("new");'));
      expect(result).toContain(chalk.green('+  console.log("additional");'));
    });
  });

  // Color code verification as required by acceptance criteria
  describe('acceptance criteria - color code verification', () => {
    it('should verify green color codes for +lines', () => {
      const diff = '+This is an added line';
      const result = renderColoredDiff(diff);
      const expected = chalk.green('+This is an added line');

      // Verify exact match with chalk output
      expect(result).toBe(expected);

      // Verify it contains green ANSI codes when chalk is enabled
      if (chalk.level > 0) {
        expect(result).toContain('\u001b[32m'); // Green ANSI code
      }
    });

    it('should verify red color codes for -lines', () => {
      const diff = '-This is a removed line';
      const result = renderColoredDiff(diff);
      const expected = chalk.red('-This is a removed line');

      // Verify exact match with chalk output
      expect(result).toBe(expected);

      // Verify it contains red ANSI codes when chalk is enabled
      if (chalk.level > 0) {
        expect(result).toContain('\u001b[31m'); // Red ANSI code
      }
    });

    it('should verify cyan color codes for @@ hunks', () => {
      const diff = '@@ -10,5 +10,6 @@ function name() {';
      const result = renderColoredDiff(diff);
      const expected = chalk.cyan(diff);

      // Verify exact match with chalk output
      expect(result).toBe(expected);

      // Verify it contains cyan ANSI codes when chalk is enabled
      if (chalk.level > 0) {
        expect(result).toContain('\u001b[36m'); // Cyan ANSI code
      }
    });

    it('should verify bold formatting for file headers', () => {
      const testCases = [
        'diff --git a/file.txt b/file.txt',
        '--- a/file.txt',
        '+++ b/file.txt'
      ];

      testCases.forEach(line => {
        const result = renderColoredDiff(line);
        const expected = chalk.bold(line);

        // Verify exact match with chalk output
        expect(result).toBe(expected);

        // Verify it contains bold ANSI codes when chalk is enabled
        if (chalk.level > 0) {
          expect(result).toContain('\u001b[1m'); // Bold ANSI code
        }
      });
    });

    it('should verify gray color codes for index lines', () => {
      const diff = 'index abc123..def456 100644';
      const result = renderColoredDiff(diff);
      const expected = chalk.gray(diff);

      // Verify exact match with chalk output
      expect(result).toBe(expected);

      // Verify it contains gray ANSI codes when chalk is enabled
      if (chalk.level > 0) {
        expect(result).toContain('\u001b[90m'); // Gray ANSI code
      }
    });

    it('should verify no color codes for context lines', () => {
      const diff = ' This is a context line';
      const result = renderColoredDiff(diff);

      // Context lines should remain unchanged
      expect(result).toBe(' This is a context line');

      // Should not contain any ANSI codes
      expect(result).not.toContain('\u001b[');
    });

    it('should correctly apply all color codes in complete diff', () => {
      const diff = [
        'diff --git a/test.js b/test.js',
        'index 1234567..abcdefg 100644',
        '--- a/test.js',
        '+++ b/test.js',
        '@@ -1,4 +1,5 @@',
        ' function test() {',
        '-  return false;',
        '+  return true;',
        '+  // Added comment',
        ' }'
      ].join('\n');

      const result = renderColoredDiff(diff);

      // Verify each line type has correct color
      expect(result).toContain(chalk.bold('diff --git a/test.js b/test.js'));
      expect(result).toContain(chalk.gray('index 1234567..abcdefg 100644'));
      expect(result).toContain(chalk.bold('--- a/test.js'));
      expect(result).toContain(chalk.bold('+++ b/test.js'));
      expect(result).toContain(chalk.cyan('@@ -1,4 +1,5 @@'));
      expect(result).toContain(chalk.red('-  return false;'));
      expect(result).toContain(chalk.green('+  return true;'));
      expect(result).toContain(chalk.green('+  // Added comment'));

      // Context lines should be unchanged
      expect(result).toContain(' function test() {');
      expect(result).toContain(' }');
    });
  });

  // Verify ANSI escape codes are present
  describe('ANSI escape code verification', () => {
    it('should contain ANSI escape codes for colors', () => {
      const diff = '+added\n-removed\n@@hunk@@';
      const result = renderColoredDiff(diff);

      // Check for ANSI escape sequences
      expect(result).toMatch(/\u001b\[/); // Contains ANSI escape codes

      // Verify specific color codes are applied
      const greenLine = chalk.green('+added');
      const redLine = chalk.red('-removed');
      const cyanLine = chalk.cyan('@@hunk@@');

      expect(result).toContain(greenLine);
      expect(result).toContain(redLine);
      expect(result).toContain(cyanLine);
    });

    it('should preserve original structure while adding colors', () => {
      const originalDiff = 'line1\n+added\n-removed\nline4';
      const result = renderColoredDiff(originalDiff);

      // Should have the same number of lines
      expect(result.split('\n')).toHaveLength(4);

      // Should preserve order
      const lines = result.split('\n');
      expect(lines[0]).toBe('line1'); // unchanged
      expect(lines[1]).toBe(chalk.green('+added'));
      expect(lines[2]).toBe(chalk.red('-removed'));
      expect(lines[3]).toBe('line4'); // unchanged
    });
  });

  // Non-diff content graceful handling
  describe('graceful degradation', () => {
    it('should handle non-diff content without errors', () => {
      const nonDiff = 'This is just regular text\nwith multiple lines\nand no diff markers';
      const result = renderColoredDiff(nonDiff);
      expect(result).toBe(nonDiff); // Should return unchanged
    });

    it('should handle mixed diff and non-diff content', () => {
      const mixed = 'regular text\n+added line\nmore regular text\n-removed line';
      const result = renderColoredDiff(mixed);

      expect(result).toContain('regular text');
      expect(result).toContain(chalk.green('+added line'));
      expect(result).toContain('more regular text');
      expect(result).toContain(chalk.red('-removed line'));
    });
  });
});