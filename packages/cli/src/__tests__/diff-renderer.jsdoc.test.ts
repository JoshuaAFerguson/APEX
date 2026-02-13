import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderColoredDiff } from '../diff-renderer.js';
import chalk from 'chalk';

/**
 * Test suite for JSDoc documented renderColoredDiff function
 * Tests the unified diff colorization functionality
 */
describe('Diff Renderer JSDoc Documented Functionality', () => {
  beforeEach(() => {
    // Ensure chalk colors are enabled for consistent testing
    chalk.level = 1;
  });

  afterEach(() => {
    // Reset chalk to default
    chalk.level = 1;
  });

  describe('renderColoredDiff function', () => {
    it('should handle empty or invalid input gracefully', () => {
      expect(renderColoredDiff('')).toBe('');
      expect(renderColoredDiff('   ')).toBe('   ');
      expect(renderColoredDiff(null as any)).toBe('');
      expect(renderColoredDiff(undefined as any)).toBe('');
      expect(renderColoredDiff(123 as any)).toBe('');
    });

    it('should colorize added lines in green', () => {
      const diff = '+This is an added line\n+Another added line';
      const result = renderColoredDiff(diff);

      // Check that the result contains ANSI color codes for green
      expect(result).toContain('\u001b[32m'); // Green color code
      expect(result).toContain('+This is an added line');
      expect(result).toContain('+Another added line');
    });

    it('should colorize removed lines in red', () => {
      const diff = '-This is a removed line\n-Another removed line';
      const result = renderColoredDiff(diff);

      // Check that the result contains ANSI color codes for red
      expect(result).toContain('\u001b[31m'); // Red color code
      expect(result).toContain('-This is a removed line');
      expect(result).toContain('-Another removed line');
    });

    it('should colorize hunk headers in cyan', () => {
      const diff = '@@ -1,3 +1,4 @@\n@@ -10,5 +11,6 @@ function example()';
      const result = renderColoredDiff(diff);

      // Check that the result contains ANSI color codes for cyan
      expect(result).toContain('\u001b[36m'); // Cyan color code
      expect(result).toContain('@@ -1,3 +1,4 @@');
      expect(result).toContain('@@ -10,5 +11,6 @@ function example()');
    });

    it('should colorize file headers in bold', () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt';
      const result = renderColoredDiff(diff);

      // Check that the result contains ANSI color codes for bold
      expect(result).toContain('\u001b[1m'); // Bold color code
      expect(result).toContain('diff --git a/file.txt b/file.txt');
      expect(result).toContain('--- a/file.txt');
      expect(result).toContain('+++ b/file.txt');
    });

    it('should colorize index lines in gray', () => {
      const diff = 'index 1234567..abcdefg 100644';
      const result = renderColoredDiff(diff);

      // Check that the result contains ANSI color codes for gray
      expect(result).toContain('\u001b[90m'); // Gray color code
      expect(result).toContain('index 1234567..abcdefg 100644');
    });

    it('should leave context lines uncolored', () => {
      const diff = ' This is a context line\n This is another context line';
      const result = renderColoredDiff(diff);

      // Context lines should not contain color codes at the start
      const lines = result.split('\n');
      expect(lines[0]).toBe(' This is a context line');
      expect(lines[1]).toBe(' This is another context line');
    });

    it('should handle complete diff example correctly', () => {
      const diff = `diff --git a/src/example.ts b/src/example.ts
index 1234567..abcdefg 100644
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,8 +1,9 @@
 export function example() {
-  const oldVariable = 'old value';
+  const newVariable = 'new value';
   console.log('This is unchanged');
+  console.log('This line was added');
   return true;
 }`;

      const result = renderColoredDiff(diff);

      // Verify different line types are colored appropriately
      expect(result).toContain('\u001b[1m'); // Bold for headers
      expect(result).toContain('\u001b[90m'); // Gray for index
      expect(result).toContain('\u001b[36m'); // Cyan for hunk header
      expect(result).toContain('\u001b[31m'); // Red for removed line
      expect(result).toContain('\u001b[32m'); // Green for added lines

      // Context lines should remain uncolored
      expect(result).toContain('export function example() {');
      expect(result).toContain('  return true;');
    });

    it('should normalize different line ending styles', () => {
      const diffWithCRLF = '+Added line with CRLF\r\n-Removed line with CRLF\r\n';
      const diffWithCR = '+Added line with CR\r-Removed line with CR\r';
      const diffWithLF = '+Added line with LF\n-Removed line with LF\n';

      const resultCRLF = renderColoredDiff(diffWithCRLF);
      const resultCR = renderColoredDiff(diffWithCR);
      const resultLF = renderColoredDiff(diffWithLF);

      // All should be normalized to use \n
      expect(resultCRLF.split('\n')).toHaveLength(3); // 2 lines + 1 empty
      expect(resultCR.split('\n')).toHaveLength(3);
      expect(resultLF.split('\n')).toHaveLength(3);

      // Should still be properly colored
      expect(resultCRLF).toContain('\u001b[32m'); // Green
      expect(resultCRLF).toContain('\u001b[31m'); // Red
    });

    it('should handle mixed line types in correct order', () => {
      const diff = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -5,7 +5,8 @@ context
 unchanged line 1
-removed line
+added line 1
+added line 2
 unchanged line 2`;

      const result = renderColoredDiff(diff);
      const lines = result.split('\n');

      // First line should be bold (diff --git)
      expect(lines[0]).toMatch(/\u001b\[1m.*diff --git/);

      // Index line should be gray
      expect(lines[1]).toMatch(/\u001b\[90m.*index/);

      // File headers should be bold
      expect(lines[2]).toMatch(/\u001b\[1m.*---/);
      expect(lines[3]).toMatch(/\u001b\[1m.*\+\+\+/);

      // Hunk header should be cyan
      expect(lines[4]).toMatch(/\u001b\[36m.*@@/);

      // Context line should have no color codes at start
      expect(lines[5]).toBe(' unchanged line 1');

      // Removed line should be red
      expect(lines[6]).toMatch(/\u001b\[31m.*-removed line/);

      // Added lines should be green
      expect(lines[7]).toMatch(/\u001b\[32m.*\+added line 1/);
      expect(lines[8]).toMatch(/\u001b\[32m.*\+added line 2/);
    });

    it('should handle edge cases with special characters', () => {
      const diff = `+Line with special chars: !@#$%^&*()
-Line with unicode: 🚀 ñáéíóú
 Context with tabs:	indented
@@@ Not a real hunk header @@@
index not-at-start of line`;

      const result = renderColoredDiff(diff);

      // Special characters should be preserved
      expect(result).toContain('!@#$%^&*()');
      expect(result).toContain('🚀 ñáéíóú');
      expect(result).toContain('\t');

      // Fake hunk header should not be colored (doesn't match pattern)
      expect(result).toContain('@@@ Not a real hunk header @@@');

      // Index not at start should not be colored
      expect(result).toContain('index not-at-start of line');
    });

    it('should handle very large diffs efficiently', () => {
      // Create a large diff with 1000 lines
      const lines = [];
      for (let i = 0; i < 500; i++) {
        lines.push(`+Added line ${i}`);
        lines.push(`-Removed line ${i}`);
      }
      const largeDiff = lines.join('\n');

      const start = Date.now();
      const result = renderColoredDiff(largeDiff);
      const duration = Date.now() - start;

      // Should complete in reasonable time (less than 100ms for 1000 lines)
      expect(duration).toBeLessThan(100);

      // Should still colorize correctly
      expect(result).toContain('\u001b[32m'); // Green
      expect(result).toContain('\u001b[31m'); // Red
      expect(result.split('\n')).toHaveLength(1000);
    });

    it('should preserve original line structure', () => {
      const diff = `line1
line2

line4
line5`;

      const result = renderColoredDiff(diff);
      const lines = result.split('\n');

      expect(lines).toHaveLength(5);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe(''); // Empty line preserved
      expect(lines[3]).toBe('line4');
      expect(lines[4]).toBe('line5');
    });

    it('should handle single-line diffs', () => {
      expect(renderColoredDiff('+Single added line')).toContain('\u001b[32m');
      expect(renderColoredDiff('-Single removed line')).toContain('\u001b[31m');
      expect(renderColoredDiff('diff --git a/file b/file')).toContain('\u001b[1m');
      expect(renderColoredDiff('@@ -1 +1 @@')).toContain('\u001b[36m');
      expect(renderColoredDiff('index 123..456')).toContain('\u001b[90m');
      expect(renderColoredDiff(' Context line')).toBe(' Context line');
    });

    it('should handle lines that start with symbols but are not diff markers', () => {
      const diff = `+++ This looks like a header but has content after
--- This also looks like a header but has content after
@@@ This looks like a hunk header but is malformed
index in the middle of the line should not be colored`;

      const result = renderColoredDiff(diff);

      // These should be treated as added/removed lines, not headers
      expect(result).toContain('\u001b[32m+++ This looks like a header');
      expect(result).toContain('\u001b[31m--- This also looks like a header');

      // Malformed hunk header should not be colored
      expect(result).toContain('@@@ This looks like a hunk header but is malformed');

      // Index not at start should not be colored
      expect(result).toContain('index in the middle of the line');
    });
  });

  describe('Color scheme validation', () => {
    it('should use consistent colors as documented', () => {
      const diff = `diff --git a/test b/test
index abc..def
--- a/test
+++ b/test
@@ -1,2 +1,3 @@
 context
-removed
+added`;

      const result = renderColoredDiff(diff);

      // Verify color codes match documentation:
      // Green for added lines
      expect(result).toMatch(/\u001b\[32m\+added/);
      // Red for removed lines
      expect(result).toMatch(/\u001b\[31m-removed/);
      // Cyan for hunk headers
      expect(result).toMatch(/\u001b\[36m@@/);
      // Bold for file headers
      expect(result).toMatch(/\u001b\[1m(diff|---|+++)/);
      // Gray for index lines
      expect(result).toMatch(/\u001b\[90mindex/);
    });
  });
});