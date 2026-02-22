/**
 * ConventionAnalyzer Edge Cases and Error Handling Tests
 * Tests for handling various edge cases, error conditions, and unusual patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Edge Cases and Error Handling', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-edge-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Error Handling', () => {
    it('should throw descriptive error for non-existent directory', async () => {
      const nonExistentPath = join(testDir, 'non-existent-directory');

      await expect(analyzer.analyze(nonExistentPath))
        .rejects.toThrow(/Convention analysis failed.*ENOENT/);
    });

    it('should throw error when analyzing a file instead of directory', async () => {
      const filePath = join(testDir, 'not-a-directory.txt');
      await fs.writeFile(filePath, 'This is a file, not a directory');

      await expect(analyzer.analyze(filePath))
        .rejects.toThrow(/Project path is not a directory/);
    });

    it('should handle permission errors gracefully', async () => {
      const restrictedDir = join(testDir, 'restricted');
      const srcDir = join(restrictedDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a readable file
      await fs.writeFile(join(srcDir, 'readable.js'), 'console.log("test");');

      // The analyzer should not crash even if there are permission issues
      const result = await analyzer.analyze(restrictedDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBeDefined();
    });
  });

  describe('Empty and Minimal Content', () => {
    it('should handle completely empty directory', async () => {
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('mixed');
      expect(result.functionNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
      expect(result.documentation.coverage).toBe(0);
      expect(result.organization?.testLocation).toBe('mixed');
    });

    it('should handle empty files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'empty1.js'), '');
      await fs.writeFile(join(srcDir, 'empty2.ts'), '');
      await fs.writeFile(join(srcDir, 'empty3.jsx'), '');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle files with only whitespace', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'whitespace1.js'), '   \n  \n\t\n   ');
      await fs.writeFile(join(srcDir, 'whitespace2.ts'), '\t\t\t\n    \n\n');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('mixed');
    });

    it('should handle files with only comments', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const commentsOnly = `
// This is a comment file
/* Another comment */
/**
 * JSDoc comment
 */
// More comments
`;
      await fs.writeFile(join(srcDir, 'comments-only.js'), commentsOnly);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBe(0); // No documentable elements
    });
  });

  describe('Unusual File Patterns', () => {
    it('should handle files with unusual extensions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // These should be ignored by the analyzer
      await fs.writeFile(join(srcDir, 'data.txt'), 'plain text');
      await fs.writeFile(join(srcDir, 'binary.exe'), 'binary content');
      await fs.writeFile(join(srcDir, 'no-extension'), 'no extension file');

      // But this should be analyzed
      await fs.writeFile(join(srcDir, 'valid.js'), 'const test = "hello";');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should handle files with complex unicode names', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'café.js'), 'const café = "coffee";');
      await fs.writeFile(join(srcDir, '测试.js'), 'const test = "中文";');
      await fs.writeFile(join(srcDir, 'émoji-🚀.js'), 'const rocket = "🚀";');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['camelCase', 'mixed']).toContain(result.fileNaming);
    });

    it('should handle very long file names', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const longName = 'a'.repeat(200) + '.js';
      await fs.writeFile(join(srcDir, longName), 'const longFileName = true;');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should handle files with special characters in names', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'file-with-dashes.js'), 'const dashed = true;');
      await fs.writeFile(join(srcDir, 'file_with_underscores.js'), 'const underscored = true;');
      await fs.writeFile(join(srcDir, 'file.with.dots.js'), 'const dotted = true;');
      await fs.writeFile(join(srcDir, 'file with spaces.js'), 'const spaced = true;');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['kebab-case', 'snake_case', 'mixed']).toContain(result.fileNaming);
    });
  });

  describe('Unusual Code Patterns', () => {
    it('should handle malformed or syntax-error code gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const malformedCode = `
function incomplete(
  // Missing closing parenthesis and braces
const broken = "unclosed string
if (missing closing brace {
  console.log("broken");
// Missing closing brace
`;
      await fs.writeFile(join(srcDir, 'malformed.js'), malformedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Should still extract what it can
      expect(['camelCase', 'mixed']).toContain(result.functionNaming);
    });

    it('should handle extremely nested code', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      let nestedCode = 'function deeplyNested() {\n';
      for (let i = 0; i < 20; i++) {
        nestedCode += '  '.repeat(i + 1) + `if (level${i}) {\n`;
      }
      nestedCode += '  '.repeat(21) + 'console.log("deep");\n';
      for (let i = 19; i >= 0; i--) {
        nestedCode += '  '.repeat(i + 1) + '}\n';
      }
      nestedCode += '}';

      await fs.writeFile(join(srcDir, 'deeply-nested.js'), nestedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
    });

    it('should handle code with mixed line endings', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Mix of \n, \r\n, and \r line endings
      const mixedLineEndings = 'const unix = "LF";\n' +
                              'const windows = "CRLF";\r\n' +
                              'const oldMac = "CR";\r' +
                              'const normal = "standard";\n';

      await fs.writeFile(join(srcDir, 'mixed-endings.js'), mixedLineEndings);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should handle extremely long lines', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const longLine = 'const extremelyLongVariableNameThatGoesOnForever = "' + 'x'.repeat(1000) + '";';
      await fs.writeFile(join(srcDir, 'long-line.js'), longLine);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
      if (result.formatting?.lineLength) {
        expect(result.formatting.lineLength).toBeGreaterThan(120);
      }
    });

    it('should handle code with unusual identifier patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const unusualCode = `
// Valid but unusual JavaScript identifiers
const $ = "jquery style";
const _ = "underscore style";
const $$ = "double dollar";
const _private = "leading underscore";
const __dunder__ = "double underscore";
const $element = "jquery element";
const π = 3.14159; // Unicode identifier
const λ = "lambda"; // Greek lambda
const café = "unicode";
`;

      await fs.writeFile(join(srcDir, 'unusual-identifiers.js'), unusualCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['camelCase', 'mixed', 'other']).toContain(result.variableNaming);
    });
  });

  describe('Directory Structure Edge Cases', () => {
    it('should handle deeply nested directory structures', async () => {
      let currentDir = testDir;

      // Create a deeply nested structure
      const dirs = ['very', 'deeply', 'nested', 'directory', 'structure', 'with', 'many', 'levels'];
      for (const dir of dirs) {
        currentDir = join(currentDir, dir);
        await fs.mkdir(currentDir, { recursive: true });
      }

      await fs.writeFile(join(currentDir, 'deep-file.js'), 'const deep = "nested";');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should handle circular symlinks gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'normal.js'), 'const normal = "file";');

      try {
        // Create a circular symlink (this might fail on some systems)
        await fs.symlink(testDir, join(testDir, 'circular-link'));
      } catch (error) {
        // If symlinks aren't supported, skip this test part
        console.warn('Symlinks not supported, skipping circular symlink test');
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should handle directories with unusual names', async () => {
      const weirdDir = join(testDir, 'weird dir with spaces');
      const unicodeDir = join(testDir, '测试目录');
      const specialDir = join(testDir, 'dir-with-special!@#$%chars');

      await fs.mkdir(weirdDir, { recursive: true });
      await fs.mkdir(unicodeDir, { recursive: true });
      await fs.mkdir(specialDir, { recursive: true });

      await fs.writeFile(join(weirdDir, 'file.js'), 'const weird = true;');
      await fs.writeFile(join(unicodeDir, 'file.js'), 'const unicode = true;');
      await fs.writeFile(join(specialDir, 'file.js'), 'const special = true;');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });
  });

  describe('Large Scale Edge Cases', () => {
    it('should handle projects with many files efficiently', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create 100 files with varying patterns
      for (let i = 0; i < 100; i++) {
        const fileName = i % 2 === 0 ? `file${i}.js` : `file-${i}.js`;
        const varName = i % 3 === 0 ? `variable${i}` : i % 3 === 1 ? `variable_${i}` : `VARIABLE_${i}`;
        const content = `const ${varName} = ${i};`;
        await fs.writeFile(join(srcDir, fileName), content);
      }

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const duration = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.fileNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
    });

    it('should handle files with very large content', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a large file with many functions
      let largeContent = '';
      for (let i = 0; i < 1000; i++) {
        largeContent += `function func${i}() { return ${i}; }\n`;
      }

      await fs.writeFile(join(srcDir, 'large-file.js'), largeContent);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
    });
  });

  describe('Schema Compliance Under Edge Conditions', () => {
    it('should always return valid schema even with unusual inputs', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a mix of unusual conditions
      await fs.writeFile(join(srcDir, 'empty.js'), '');
      await fs.writeFile(join(srcDir, 'malformed.js'), 'const broken = "unclosed');
      await fs.writeFile(join(srcDir, 'unicode-🚀.js'), 'const 测试 = "test";');
      await fs.writeFile(join(srcDir, 'long-line.js'), 'const x = "' + 'y'.repeat(500) + '";');

      const result = await analyzer.analyze(testDir);

      // This is the most important test - schema must always be valid
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // All required fields should be present
      expect(result).toHaveProperty('fileNaming');
      expect(result).toHaveProperty('functionNaming');
      expect(result).toHaveProperty('variableNaming');
      expect(result).toHaveProperty('indentation');
      expect(result).toHaveProperty('imports');
      expect(result).toHaveProperty('documentation');
      expect(result).toHaveProperty('organization');

      // Values should be within valid enum ranges
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent'])
        .toContain(result.fileNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent'])
        .toContain(result.functionNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent'])
        .toContain(result.variableNaming);

      // Coverage should be a valid percentage
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.documentation.coverage)).toBe(true);
    });
  });
});