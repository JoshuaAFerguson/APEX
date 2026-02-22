/**
 * ConventionAnalyzer File Organization Edge Cases Tests
 *
 * Tests edge cases, error conditions, and boundary scenarios for file organization
 * pattern detection to ensure robust analysis under all conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - File Organization Edge Cases', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-edge-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File System Edge Cases', () => {
    it('should handle empty directories gracefully', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(testDir, 'tests');
      const emptyDir1 = join(testDir, 'empty1');
      const emptyDir2 = join(testDir, 'empty2');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(emptyDir1, { recursive: true });
      await fs.mkdir(emptyDir2, { recursive: true });

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
      expect(result.organization?.testNaming).toBe('mixed');
      expect(result.organization?.sourceStructure).toBe('mixed');
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = join(testDir, 'does-not-exist');

      await expect(analyzer.analyze(nonExistentDir)).rejects.toThrow(/Project path is not a directory/);
    });

    it('should handle directory with no analyzable files', async () => {
      // Create files with unsupported extensions
      await fs.writeFile(join(testDir, 'data.db'), 'binary data');
      await fs.writeFile(join(testDir, 'image.png'), 'binary image');
      await fs.writeFile(join(testDir, 'video.mp4'), 'binary video');
      await fs.writeFile(join(testDir, 'README.md'), '# Project Title\nThis is a readme.');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
      expect(result.organization?.sourceStructure).toBe('mixed');
    });

    it('should handle very long file paths', async () => {
      // Create deeply nested structure
      let currentDir = testDir;
      const longPath = ['very', 'deeply', 'nested', 'directory', 'structure', 'with', 'many', 'levels', 'that', 'creates', 'a', 'very', 'long', 'path'];

      for (const segment of longPath) {
        currentDir = join(currentDir, segment);
        await fs.mkdir(currentDir, { recursive: true });
      }

      await fs.writeFile(join(currentDir, 'deep-file.js'), 'export const deepFile = true;');
      await fs.writeFile(join(currentDir, 'deep-file.test.js'), 'test("deep file", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test');
    });

    it('should handle file names with special characters', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Files with special characters in names
      await fs.writeFile(join(srcDir, 'file-with-dashes.js'), 'export const dashFile = true;');
      await fs.writeFile(join(srcDir, 'file_with_underscores.js'), 'export const underscoreFile = true;');
      await fs.writeFile(join(srcDir, 'file.with.dots.js'), 'export const dotFile = true;');
      await fs.writeFile(join(srcDir, 'file with spaces.js'), 'export const spaceFile = true;');
      await fs.writeFile(join(srcDir, 'fileWithNumbers123.js'), 'export const numberFile = true;');

      // Corresponding test files
      await fs.writeFile(join(srcDir, 'file-with-dashes.test.js'), 'test("dash file", () => {});');
      await fs.writeFile(join(srcDir, 'file_with_underscores.test.js'), 'test("underscore file", () => {});');
      await fs.writeFile(join(srcDir, 'file.with.dots.test.js'), 'test("dot file", () => {});');
      await fs.writeFile(join(srcDir, 'file with spaces.test.js'), 'test("space file", () => {});');
      await fs.writeFile(join(srcDir, 'fileWithNumbers123.test.js'), 'test("number file", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
    });

    it('should handle circular symbolic links gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'real-file.js'), 'export const realFile = true;');
      await fs.writeFile(join(srcDir, 'real-file.test.js'), 'test("real file", () => {});');

      // Create circular symlinks if supported
      try {
        const link1 = join(srcDir, 'link1');
        const link2 = join(srcDir, 'link2');
        await fs.symlink(link2, link1, 'dir');
        await fs.symlink(link1, link2, 'dir');
      } catch (error) {
        // Skip this part if symlinks are not supported
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
    });
  });

  describe('File Content Edge Cases', () => {
    it('should handle files with unusual encodings', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Files that might have encoding issues
      await fs.writeFile(join(srcDir, 'unicode.js'), 'export const café = "café"; // UTF-8 characters');
      await fs.writeFile(join(srcDir, 'unicode.test.js'), 'test("café", () => {});');

      // Empty files
      await fs.writeFile(join(srcDir, 'empty.js'), '');
      await fs.writeFile(join(srcDir, 'empty.test.js'), '');

      // Files with only whitespace
      await fs.writeFile(join(srcDir, 'whitespace.js'), '   \n\t\n   ');
      await fs.writeFile(join(srcDir, 'whitespace.test.js'), '   \n\t\n   ');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test');
    });

    it('should handle binary files mixed with text files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Text files
      await fs.writeFile(join(srcDir, 'component.js'), 'export const Component = () => {};');
      await fs.writeFile(join(srcDir, 'component.test.js'), 'test("component", () => {});');

      // Binary-like files with supported extensions
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      await fs.writeFile(join(srcDir, 'binary.js'), binaryData);
      await fs.writeFile(join(srcDir, 'binary.test.js'), binaryData);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test');
    });
  });

  describe('Complex Pattern Combinations', () => {
    it('should handle multiple test naming patterns in same directory', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Mix of different test naming patterns
      await fs.writeFile(join(srcDir, 'module1.js'), 'export const module1 = true;');
      await fs.writeFile(join(srcDir, 'module1.test.js'), 'test("module1", () => {});');

      await fs.writeFile(join(srcDir, 'module2.js'), 'export const module2 = true;');
      await fs.writeFile(join(srcDir, 'module2.spec.js'), 'describe("module2", () => {});');

      await fs.writeFile(join(srcDir, 'Module3.java'), 'class Module3 {}');
      await fs.writeFile(join(srcDir, 'Module3Test.java'), 'class Module3Test {}');

      await fs.writeFile(join(srcDir, 'module4.py'), 'def module4(): pass');
      await fs.writeFile(join(srcDir, 'test_module4.py'), 'def test_module4(): pass');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('mixed');
    });

    it('should handle inconsistent test file extensions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Source files with different extensions
      await fs.writeFile(join(srcDir, 'component.js'), 'export const Component = () => {};');
      await fs.writeFile(join(srcDir, 'service.ts'), 'export class Service {}');
      await fs.writeFile(join(srcDir, 'utils.jsx'), 'export const Utils = () => {};');

      // Test files with inconsistent extensions
      await fs.writeFile(join(srcDir, 'component.test.ts'), 'test("component", () => {});'); // Different ext
      await fs.writeFile(join(srcDir, 'service.spec.js'), 'describe("service", () => {});');   // Different ext
      await fs.writeFile(join(srcDir, 'utils.test.jsx'), 'test("utils", () => {});');          // Same ext

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(['mixed', 'suffix-.test', 'suffix-.spec']).toContain(result.organization?.testNaming);
    });

    it('should handle ambiguous directory structures', async () => {
      // Create structure that could be interpreted multiple ways
      const testsDir = join(testDir, 'tests');
      const srcTestsDir = join(testDir, 'src', 'tests');
      const libTestsDir = join(testDir, 'lib', '__tests__');

      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(srcTestsDir, { recursive: true });
      await fs.mkdir(libTestsDir, { recursive: true });

      // Files in different test locations
      await fs.writeFile(join(testsDir, 'global.test.js'), 'test("global", () => {});');
      await fs.writeFile(join(srcTestsDir, 'src.test.js'), 'test("src", () => {});');
      await fs.writeFile(join(libTestsDir, 'lib.test.js'), 'test("lib", () => {});');

      // Source files
      await fs.writeFile(join(testDir, 'src', 'index.js'), 'export const main = true;');
      await fs.writeFile(join(testDir, 'lib', 'utils.js'), 'export const utils = true;');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
      expect(result.organization?.sourceStructure).toBe('mixed');
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle single file projects', async () => {
      await fs.writeFile(join(testDir, 'index.js'), 'console.log("hello world");');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('mixed');
      expect(result.organization?.testNaming).toBe('mixed');
      expect(result.organization?.sourceStructure).toBe('root-level');
    });

    it('should handle projects with only test files', async () => {
      const testsDir = join(testDir, 'tests');
      await fs.mkdir(testsDir, { recursive: true });

      await fs.writeFile(join(testsDir, 'example.test.js'), 'test("example", () => {});');
      await fs.writeFile(join(testsDir, 'another.spec.js'), 'describe("another", () => {});');
      await fs.writeFile(join(testsDir, 'TestClass.java'), 'class TestClass {}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.testNaming).toBe('mixed');
    });

    it('should handle projects with only configuration files', async () => {
      await fs.writeFile(join(testDir, 'package.json'), '{"name": "config-only"}');
      await fs.writeFile(join(testDir, 'tsconfig.json'), '{}');
      await fs.writeFile(join(testDir, '.eslintrc.js'), 'module.exports = {};');
      await fs.writeFile(join(testDir, 'jest.config.js'), 'module.exports = {};');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.configLocation).toBe('root');
      expect(result.organization?.sourceStructure).toBe('mixed');
    });

    it('should handle extremely small threshold cases', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Just enough files to trigger analysis but at boundary conditions
      await fs.writeFile(join(srcDir, 'file1.js'), 'export const a = 1;');
      await fs.writeFile(join(srcDir, 'file1.test.js'), 'test("a", () => {});');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle directories with many irrelevant files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create many non-analyzable files
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(join(testDir, `data${i}.csv`), 'col1,col2,col3\n1,2,3');
        await fs.writeFile(join(testDir, `image${i}.png`), 'fake image data');
        await fs.writeFile(join(testDir, `doc${i}.pdf`), 'fake pdf data');
      }

      // Add just a few analyzable files
      await fs.writeFile(join(srcDir, 'main.js'), 'export const main = true;');
      await fs.writeFile(join(srcDir, 'main.test.js'), 'test("main", () => {});');

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const duration = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.sourceStructure).toBe('src');

      // Should complete in reasonable time despite many irrelevant files
      expect(duration).toBeLessThan(3000);
    });

    it('should handle directories with deeply nested but sparse structure', async () => {
      let currentDir = testDir;

      // Create 15 levels of nesting
      for (let level = 0; level < 15; level++) {
        currentDir = join(currentDir, `level${level}`);
        await fs.mkdir(currentDir, { recursive: true });

        // Add a file at each level
        if (level % 5 === 0) {
          await fs.writeFile(join(currentDir, `file${level}.js`), `export const level${level} = true;`);
          await fs.writeFile(join(currentDir, `file${level}.test.js`), `test("level${level}", () => {});`);
        }
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.testNaming).toBe('suffix-.test');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue analysis when encountering unreadable files', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Readable files
      await fs.writeFile(join(srcDir, 'good.js'), 'export const good = true;');
      await fs.writeFile(join(srcDir, 'good.test.js'), 'test("good", () => {});');

      // Create a file and then make it unreadable (if possible)
      const unreadableFile = join(srcDir, 'unreadable.js');
      await fs.writeFile(unreadableFile, 'export const unreadable = true;');

      try {
        await fs.chmod(unreadableFile, 0o000);
      } catch (error) {
        // Skip if chmod not supported
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.sourceStructure).toBe('src');

      // Cleanup
      try {
        await fs.chmod(unreadableFile, 0o644);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should handle mixed file system permissions gracefully', async () => {
      const srcDir = join(testDir, 'src');
      const restrictedDir = join(testDir, 'restricted');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(restrictedDir, { recursive: true });

      // Normal files
      await fs.writeFile(join(srcDir, 'normal.js'), 'export const normal = true;');
      await fs.writeFile(join(srcDir, 'normal.test.js'), 'test("normal", () => {});');

      // Files in restricted directory
      await fs.writeFile(join(restrictedDir, 'restricted.js'), 'export const restricted = true;');

      try {
        await fs.chmod(restrictedDir, 0o000);
      } catch (error) {
        // Skip if chmod not supported
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.organization?.testLocation).toBe('colocated');
      expect(result.organization?.sourceStructure).toBe('mixed');

      // Cleanup
      try {
        await fs.chmod(restrictedDir, 0o755);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should always return valid schema even with unusual input combinations', async () => {
      // Create an unusual but valid project structure
      const weirdDir1 = join(testDir, '123numeric');
      const weirdDir2 = join(testDir, 'UPPERCASE');
      const weirdDir3 = join(testDir, 'mixed-Case_and.dots');

      await fs.mkdir(weirdDir1, { recursive: true });
      await fs.mkdir(weirdDir2, { recursive: true });
      await fs.mkdir(weirdDir3, { recursive: true });

      // Files with unusual but valid combinations
      await fs.writeFile(join(weirdDir1, '1st-file.js'), 'export const first = 1;');
      await fs.writeFile(join(weirdDir1, '1st-file.SPEC.js'), 'test("first", () => {});');

      await fs.writeFile(join(weirdDir2, 'SECOND.JS'), 'export const SECOND = 2;');
      await fs.writeFile(join(weirdDir2, 'SECOND.TEST.JS'), 'test("SECOND", () => {});');

      await fs.writeFile(join(weirdDir3, 'third_file.ts'), 'export const thirdFile = 3;');
      await fs.writeFile(join(weirdDir3, 'third_file.spec.ts'), 'test("third", () => {});');

      const result = await analyzer.analyze(testDir);

      // Should not throw and return valid schema
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // All organization fields should be defined and valid
      expect(result.organization).toBeDefined();
      expect(result.organization?.testLocation).toBeDefined();
      expect(result.organization?.testNaming).toBeDefined();
      expect(result.organization?.sourceStructure).toBeDefined();

      // Check enum values are valid
      const validTestLocations = ['colocated', 'separate-__tests__', 'separate-tests', 'mixed'];
      const validTestNaming = ['suffix-.test', 'suffix-.spec', 'suffix-Test', 'prefix-test-', 'mixed'];
      const validSourceStructures = ['src', 'lib', 'app', 'source', 'root-level', 'mixed'];

      expect(validTestLocations).toContain(result.organization?.testLocation);
      expect(validTestNaming).toContain(result.organization?.testNaming);
      expect(validSourceStructures).toContain(result.organization?.sourceStructure);
    });
  });
});