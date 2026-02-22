/**
 * ConventionAnalyzer Boundary Conditions and Validation Tests
 * Tests for boundary conditions, schema validation, and error cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Boundary Conditions and Validation', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-boundary-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schema Validation Boundaries', () => {
    it('should ensure indentation size stays within schema bounds (1-8)', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Test with various indentation sizes to ensure they map to valid schema values
      const testCases = [
        { spaces: 1, expected: 1 },
        { spaces: 2, expected: 2 },
        { spaces: 3, expected: 3 },
        { spaces: 4, expected: 4 },
        { spaces: 5, expected: 5 },
        { spaces: 6, expected: 6 },
        { spaces: 7, expected: 7 },
        { spaces: 8, expected: 8 },
      ];

      for (const testCase of testCases) {
        const indentString = ' '.repeat(testCase.spaces);
        const code = `function test() {
${indentString}const x = 1;
${indentString}if (x > 0) {
${indentString}${indentString}console.log('nested');
${indentString}}
}`;

        await fs.writeFile(join(srcDir, `indent-${testCase.spaces}.js`), code);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('mixed'); // Mixed sizes
      expect(result.indentation.size).toBeGreaterThanOrEqual(1);
      expect(result.indentation.size).toBeLessThanOrEqual(8);
    });

    it('should ensure line length stays within schema bounds (40-200)', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Test minimum line length boundary
      const shortCode = `const x = 1;
const y = 2;
function f() {
  return x + y;
}`;

      // Test maximum line length boundary (but not exceeding 200)
      const longLine = 'a'.repeat(180); // 180 characters
      const longCode = `const ${longLine} = 'very long variable name';
function normalFunction() {
  return 'normal line';
}`;

      await fs.writeFile(join(srcDir, 'short.js'), shortCode);
      await fs.writeFile(join(srcDir, 'long.js'), longCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      if (result.formatting?.lineLength) {
        expect(result.formatting.lineLength).toBeGreaterThanOrEqual(40);
        expect(result.formatting.lineLength).toBeLessThanOrEqual(200);
      }
    });

    it('should ensure documentation coverage stays within 0-100 range', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a file with exactly calculated coverage
      const partiallyDocumentedCode = `
/**
 * Documented function 1
 */
function func1() { return 1; }

function func2() { return 2; } // Undocumented

/**
 * Documented function 3
 */
function func3() { return 3; }

function func4() { return 4; } // Undocumented
function func5() { return 5; } // Undocumented
`; // Should be 40% coverage (2/5 functions documented)

      await fs.writeFile(join(srcDir, 'partial-docs.js'), partiallyDocumentedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.documentation.coverage)).toBe(true);
      expect(result.documentation.coverage).toBe(40); // 2 out of 5 documented
    });
  });

  describe('Edge Case Combinations', () => {
    it('should handle combinations that might break individual detectors', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // File with conflicting patterns that might confuse the analyzer
      const conflictingCode = `// File with intentionally conflicting patterns
function spacesFunction() {
  const x = 1; // 2 spaces
  if (x > 0) {
    console.log("double quotes"); // 4 spaces total
  }
}

function\ttabsFunction()\t{
\tconst\ty\t=\t2;\t//\ttabs\teverywhere
\tif\t(y\t>\t0)\t{
\t\tconsole.log('single quotes with semicolon');
\t}
}

function noSemicolonFunction() {
  const z = 3 // No semicolon
  if (z > 0) {
    console.log(\`template literal with \${z}\`) // No semicolon, backticks
  }
}

const mixedObject = {
  prop1: "double",
  prop2: 'single',
  prop3: \`template\`,
  prop4: {
    nested: "more double",
    deeper: 'more single'
  } // No trailing comma
};

const withTrailing = {
  a: 1,
  b: 2,
  c: 3, // Trailing comma
};`;

      await fs.writeFile(join(srcDir, 'conflicting.js'), conflictingCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should handle mixed patterns gracefully
      expect(result.indentation.type).toBe('mixed');
      expect(result.formatting?.quotes).toBe('mixed');
      expect(result.formatting?.semicolons).toBe('mixed');
      expect(result.formatting?.trailingCommas).toBe('mixed');
    });

    it('should handle files with only non-analyzable extensions mixed with analyzable ones', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create non-analyzable files
      await fs.writeFile(join(srcDir, 'image.png'), Buffer.from('fake image data'));
      await fs.writeFile(join(srcDir, 'document.pdf'), 'fake pdf content');
      await fs.writeFile(join(srcDir, 'data.bin'), Buffer.from([0x00, 0x01, 0x02]));

      // Create one analyzable file
      const validCode = `function example() {
  const message = 'This is the only valid code';
  return message;
}`;

      await fs.writeFile(join(srcDir, 'valid.js'), validCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle nested directories with different conventions', async () => {
      const srcDir = join(testDir, 'src');
      const legacyDir = join(srcDir, 'legacy');
      const modernDir = join(srcDir, 'modern');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(legacyDir, { recursive: true });
      await fs.mkdir(modernDir, { recursive: true });

      // Legacy code with old-style conventions
      const legacyCode = `function legacyFunction() {
    var x = 1; // 4 spaces, var, semicolons
    var y = 2;

    if (x > 0) {
        console.log("Legacy uses double quotes");
        if (y > 0) {
            return x + y;
        }
    }

    return 0;
}`;

      // Modern code with new conventions
      const modernCode = `const modernFunction = () => {
  const x = 1 // 2 spaces, const, no semicolons
  const y = 2

  if (x > 0) {
    console.log('Modern uses single quotes')

    if (y > 0) {
      return x + y
    }
  }

  return 0
}

export { modernFunction }`;

      await fs.writeFile(join(legacyDir, 'legacy.js'), legacyCode);
      await fs.writeFile(join(modernDir, 'modern.js'), modernCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should detect mixed patterns due to different conventions in different directories
      expect(result.indentation.type).toBe('mixed');
      expect(result.formatting?.quotes).toBe('mixed');
      expect(result.formatting?.semicolons).toBe('mixed');
    });
  });

  describe('Extreme File Sizes and Edge Cases', () => {
    it('should handle very small files correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Minimal valid JavaScript files
      await fs.writeFile(join(srcDir, 'minimal1.js'), '1');
      await fs.writeFile(join(srcDir, 'minimal2.js'), 'x');
      await fs.writeFile(join(srcDir, 'minimal3.js'), '{}');
      await fs.writeFile(join(srcDir, 'minimal4.js'), '[]');
      await fs.writeFile(join(srcDir, 'minimal5.js'), '""');
      await fs.writeFile(join(srcDir, 'minimal6.js'), "''");

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should provide defaults for files with no analyzable patterns
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle files with only whitespace and newlines', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const whitespaceVariations = [
        '   \n   \n   ', // Spaces and newlines
        '\t\n\t\n\t',   // Tabs and newlines
        '  \t  \n  \t', // Mixed spaces/tabs
        '\n\n\n\n\n',   // Only newlines
        '        ',       // Only spaces
        '\t\t\t\t',     // Only tabs
      ];

      for (let i = 0; i < whitespaceVariations.length; i++) {
        await fs.writeFile(join(srcDir, `whitespace${i}.js`), whitespaceVariations[i]);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2); // Default
    });

    it('should handle files with extremely nested structures', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create deeply nested structure (but reasonable)
      let nestedCode = 'function deeplyNested() {\n';
      let currentIndent = '  ';

      for (let depth = 1; depth <= 10; depth++) {
        nestedCode += `${currentIndent}if (condition${depth}) {\n`;
        currentIndent += '  ';
        nestedCode += `${currentIndent}console.log('depth ${depth}');\n`;
      }

      // Close all the if statements
      for (let depth = 10; depth >= 1; depth--) {
        currentIndent = currentIndent.slice(0, -2);
        nestedCode += `${currentIndent}}\n`;
      }
      nestedCode += '}';

      await fs.writeFile(join(srcDir, 'deeply-nested.js'), nestedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle symbolic links if they exist', async () => {
      const srcDir = join(testDir, 'src');
      const targetDir = join(testDir, 'target');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });

      // Create a real file
      const realCode = `function realFunction() {
  return 'real code';
}`;

      await fs.writeFile(join(targetDir, 'real.js'), realCode);
      await fs.writeFile(join(srcDir, 'normal.js'), realCode);

      // Try to create a symbolic link (might not work on all systems)
      try {
        await fs.symlink(join(targetDir, 'real.js'), join(srcDir, 'link.js'));
      } catch (error) {
        // Skip this test on systems that don't support symlinks
        return;
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
    });

    it('should handle files with various line ending types', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Unix line endings (LF)
      const unixCode = 'function unix() {\n  return "unix";\n}';

      // Windows line endings (CRLF)
      const windowsCode = 'function windows() {\r\n  return "windows";\r\n}';

      // Mixed line endings
      const mixedCode = 'function mixed() {\n  const x = 1;\r\n  return x;\n}';

      await fs.writeFile(join(srcDir, 'unix.js'), unixCode);
      await fs.writeFile(join(srcDir, 'windows.js'), windowsCode);
      await fs.writeFile(join(srcDir, 'mixed.js'), mixedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle non-standard file extensions that are still analyzable', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const jsCode = `function example() {
  return 'JavaScript code';
}`;

      // Test various extensions
      const extensions = [
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
        'vue', 'py', 'rb', 'go', 'rs', 'java',
        'kt', 'php', 'cs', 'cpp', 'c', 'h',
        'hpp', 'swift', 'm', 'scala', 'clj',
        'dart', 'html', 'css', 'scss', 'sass',
        'less', 'json', 'yaml', 'yml', 'toml', 'xml'
      ];

      for (const ext of extensions) {
        await fs.writeFile(join(srcDir, `file.${ext}`), jsCode);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });
  });

  describe('Concurrent Analysis Safety', () => {
    it('should handle multiple simultaneous analysis calls safely', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const code = `function concurrent() {
  const x = 1;
  return x;
}`;

      await fs.writeFile(join(srcDir, 'concurrent.js'), code);

      // Run multiple analyses concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(analyzer.analyze(testDir));
      }

      const results = await Promise.all(promises);

      // All results should be valid and similar
      for (const result of results) {
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.indentation.type).toBe('spaces');
        expect(result.indentation.size).toBe(2);
      }
    });
  });
});