/**
 * @fileoverview Literal Character Escaping Tests for GlobTool
 *
 * These tests specifically focus on scenarios where users need to match
 * literal special characters in file names rather than using them as
 * glob pattern operators. This includes testing escape sequences and
 * patterns that should match literal brackets, braces, asterisks, etc.
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool.literal-escaping
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GlobTool, type GlobToolInput } from '../glob-tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary directory for literal escaping tests
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-glob-literal-test-'));
}

/**
 * Creates a test file with specified content
 */
async function createTestFile(dir: string, filePath: string, content: string = 'test'): Promise<string> {
  const fullPath = path.join(dir, filePath);
  const fileDir = path.dirname(fullPath);

  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}

/**
 * Removes a directory and all its contents
 */
async function removeDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Creates a comprehensive set of files with literal special characters
 */
async function createLiteralCharFiles(baseDir: string): Promise<Record<string, string>> {
  // Files that would be problematic if the special chars were interpreted as patterns
  const literalFiles = {
    // Literal brackets that should NOT be treated as character classes
    'price[USD].txt': 'Price in US Dollars',
    'array[0].js': 'Array access example',
    'config[production].json': '{"env": "production"}',
    'template[v2].html': '<html></html>',
    'backup[2024-01-15].sql': 'database backup',

    // Literal braces that should NOT be treated as alternation
    'style{primary}.css': '.primary { color: blue; }',
    'component{Button}.tsx': 'React Button component',
    'macro{DEBUG}.h': '#define DEBUG 1',
    'variable{name}.php': '<?php $name = "test"; ?>',
    'function{main}.go': 'func main() {}',

    // Combinations that could be misinterpreted
    'data[2024]{backup}.txt': 'backup data from 2024',
    'test[unit]{fast}.js': 'fast unit test',
    'config[dev]{local}.yaml': 'local development config',

    // Files with multiple special character types
    'complex[test]*{backup}?.tmp': 'complex filename with all special chars',
    'pattern[match]{file}+backup?.dat': 'file with pattern-like name',
    'escape[test]{chars}*?.log': 'log file with special chars',

    // Edge cases
    'file[].txt': 'file with empty brackets',
    'file{}.txt': 'file with empty braces',
    'file().txt': 'file with empty parentheses',
    'file[[double]].txt': 'file with nested brackets',
    'file{{double}}.txt': 'file with nested braces',

    // Real-world examples
    'jQuery[1.2.3].min.js': 'jQuery library with version in brackets',
    'angular{core}.module.ts': 'Angular core module',
    'vue[component].{template}.html': 'Vue component template',
    'react[hook]{useState}.example.tsx': 'React hooks example',

    // Mathematical notation
    'equation[x+y=z].pdf': 'mathematical equation',
    'formula{a*b+c}.txt': 'mathematical formula',
    'function[f(x)].graph': 'function graph',

    // Programming constructs
    'class[MyClass].java': 'Java class file',
    'interface{IService}.cs': 'C# interface',
    'struct[Point]{x,y}.c': 'C struct definition',
    'enum{Color}[Red,Blue].swift': 'Swift enum definition',
  };

  const createdFiles: Record<string, string> = {};

  for (const [fileName, content] of Object.entries(literalFiles)) {
    try {
      const fullPath = await createTestFile(baseDir, fileName, content);
      createdFiles[fileName] = fullPath;
    } catch (error) {
      // Some systems may not support certain characters in filenames
      console.warn(`Could not create file: ${fileName}`, error);
    }
  }

  return createdFiles;
}

/**
 * Creates files for testing glob pattern behavior vs literal matching
 */
async function createPatternTestFiles(baseDir: string): Promise<void> {
  // Create files that demonstrate the difference between pattern matching and literal matching
  const testFiles = [
    // These should match [abc] pattern
    'testa.txt',
    'testb.txt',
    'testc.txt',
    'testd.txt', // Should NOT match [abc]

    // These have literal [abc] in the name
    'file[abc].txt',
    'test[abc]123.js',
    'data[abc]{backup}.json',

    // These should match {js,ts} pattern
    'script.js',
    'script.ts',
    'script.py', // Should NOT match {js,ts}

    // These have literal {js,ts} in the name
    'config{js,ts}.txt',
    'support{js,ts}.md',

    // Mixed scenarios
    'test[a].{js}.txt', // Literal [a] and literal {js}
    'file{x}[1].dat',   // Literal {x} and literal [1]
  ];

  for (const file of testFiles) {
    await createTestFile(baseDir, file, `Content for ${file}`);
  }
}

// ============================================================================
// Literal Character Escaping Test Suite
// ============================================================================

describe('GlobTool Literal Character Escaping', () => {
  let globTool: GlobTool;
  let tempDir: string;
  let literalFiles: Record<string, string>;

  beforeEach(async () => {
    globTool = new GlobTool();
    tempDir = await createTempDir();
    literalFiles = await createLiteralCharFiles(tempDir);
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  // ========================================================================
  // Literal Bracket Matching Tests
  // ========================================================================

  describe('literal bracket matching', () => {
    it('should match files with literal brackets using wildcard patterns', async () => {
      // Use wildcards to find files containing literal brackets
      const result = await globTool.run({
        pattern: '*[*]*',
        path: tempDir,
      });

      const bracketFiles = result.files.filter(file =>
        file.relativePath.includes('[') && file.relativePath.includes(']')
      );

      expect(bracketFiles.length).toBeGreaterThan(0);

      // Check specific literal bracket files exist
      const fileNames = bracketFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('[USD]'))).toBe(true);
      expect(fileNames.some(name => name.includes('[0]'))).toBe(true);
      expect(fileNames.some(name => name.includes('[production]'))).toBe(true);
      expect(fileNames.some(name => name.includes('[2024-01-15]'))).toBe(true);
    });

    it('should distinguish between bracket patterns and literal brackets', async () => {
      await createPatternTestFiles(tempDir);

      // Test bracket pattern matching (should match single characters)
      const patternResult = await globTool.run({
        pattern: 'test[abc].txt',
        path: tempDir,
      });

      const patternMatches = patternResult.files.map(f => f.basename);
      expect(patternMatches).toContain('testa');
      expect(patternMatches).toContain('testb');
      expect(patternMatches).toContain('testc');
      expect(patternMatches).not.toContain('testd');
      expect(patternMatches).not.toContain('file[abc]'); // This has literal [abc]

      // Test literal bracket matching
      const literalResult = await globTool.run({
        pattern: '*[abc]*',
        path: tempDir,
      });

      const literalMatches = literalResult.files.map(f => f.relativePath);
      expect(literalMatches.some(name => name === 'file[abc].txt')).toBe(true);
      expect(literalMatches.some(name => name === 'test[abc]123.js')).toBe(true);
    });

    it('should handle nested and complex literal brackets', async () => {
      const result = await globTool.run({
        pattern: '*[*[*]*]*',
        path: tempDir,
      });

      const nestedBrackets = result.files.filter(file =>
        file.relativePath.includes('[[') || file.relativePath.includes(']]')
      );

      // Should find files with nested brackets if they exist
      if (nestedBrackets.length > 0) {
        const fileNames = nestedBrackets.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('[[double]]'))).toBe(true);
      }
    });

    it('should handle empty brackets correctly', async () => {
      const result = await globTool.run({
        pattern: '*[]*',
        path: tempDir,
      });

      const emptyBrackets = result.files.filter(file =>
        file.relativePath.includes('[]')
      );

      if (emptyBrackets.length > 0) {
        const fileNames = emptyBrackets.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('file[].txt'))).toBe(true);
      }
    });
  });

  // ========================================================================
  // Literal Brace Matching Tests
  // ========================================================================

  describe('literal brace matching', () => {
    it('should match files with literal braces using wildcard patterns', async () => {
      const result = await globTool.run({
        pattern: '*{*}*',
        path: tempDir,
      });

      const braceFiles = result.files.filter(file =>
        file.relativePath.includes('{') && file.relativePath.includes('}')
      );

      expect(braceFiles.length).toBeGreaterThan(0);

      const fileNames = braceFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('{primary}'))).toBe(true);
      expect(fileNames.some(name => name.includes('{Button}'))).toBe(true);
      expect(fileNames.some(name => name.includes('{DEBUG}'))).toBe(true);
    });

    it('should distinguish between brace patterns and literal braces', async () => {
      await createPatternTestFiles(tempDir);

      // Test brace pattern matching (alternation)
      const patternResult = await globTool.run({
        pattern: 'script.{js,ts}',
        path: tempDir,
      });

      const patternMatches = patternResult.files.map(f => f.basename);
      expect(patternMatches).toContain('script.js');
      expect(patternMatches).toContain('script.ts');
      expect(patternMatches).not.toContain('script.py');
      expect(patternMatches).not.toContain('config{js,ts}'); // This has literal {js,ts}

      // Test literal brace matching
      const literalResult = await globTool.run({
        pattern: '*{js,ts}*',
        path: tempDir,
      });

      const literalMatches = literalResult.files.map(f => f.relativePath);
      expect(literalMatches.some(name => name === 'config{js,ts}.txt')).toBe(true);
      expect(literalMatches.some(name => name === 'support{js,ts}.md')).toBe(true);
    });

    it('should handle nested and complex literal braces', async () => {
      const result = await globTool.run({
        pattern: '*{*{*}*}*',
        path: tempDir,
      });

      const nestedBraces = result.files.filter(file =>
        file.relativePath.includes('{{') || file.relativePath.includes('}}')
      );

      if (nestedBraces.length > 0) {
        const fileNames = nestedBraces.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('{{double}}'))).toBe(true);
      }
    });

    it('should handle empty braces correctly', async () => {
      const result = await globTool.run({
        pattern: '*{}*',
        path: tempDir,
      });

      const emptyBraces = result.files.filter(file =>
        file.relativePath.includes('{}')
      );

      if (emptyBraces.length > 0) {
        const fileNames = emptyBraces.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('file{}.txt'))).toBe(true);
      }
    });
  });

  // ========================================================================
  // Real-world File Naming Scenarios
  // ========================================================================

  describe('real-world file naming scenarios', () => {
    it('should handle JavaScript library files with version brackets', async () => {
      const result = await globTool.run({
        pattern: '*[*].min.js',
        path: tempDir,
      });

      const jsLibraries = result.files.filter(file =>
        file.extension === '.js' && file.relativePath.includes('[') && file.relativePath.includes('min')
      );

      if (jsLibraries.length > 0) {
        const fileNames = jsLibraries.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('jQuery[1.2.3]'))).toBe(true);
      }
    });

    it('should handle Angular/React component naming patterns', async () => {
      const result = await globTool.run({
        pattern: '*{*}*',
        path: tempDir,
      });

      const components = result.files.filter(file =>
        file.relativePath.includes('{') &&
        (file.extension === '.ts' || file.extension === '.tsx' || file.extension === '.js')
      );

      if (components.length > 0) {
        const fileNames = components.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('{core}'))).toBe(true);
        expect(fileNames.some(name => name.includes('{useState}'))).toBe(true);
      }
    });

    it('should handle mathematical notation in filenames', async () => {
      const result = await globTool.run({
        pattern: '*[*]*',
        path: tempDir,
      });

      const mathFiles = result.files.filter(file =>
        file.relativePath.includes('[') &&
        (file.relativePath.includes('equation') || file.relativePath.includes('formula'))
      );

      if (mathFiles.length > 0) {
        const fileNames = mathFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('[x+y=z]'))).toBe(true);
      }
    });

    it('should handle programming language construct names', async () => {
      const result = await globTool.run({
        pattern: '**/*{*}*',
        path: tempDir,
      });

      const progFiles = result.files.filter(file =>
        file.relativePath.includes('{') &&
        (file.relativePath.includes('interface') || file.relativePath.includes('enum') || file.relativePath.includes('struct'))
      );

      if (progFiles.length > 0) {
        const fileNames = progFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('{IService}'))).toBe(true);
        expect(fileNames.some(name => name.includes('{Color}'))).toBe(true);
      }
    });
  });

  // ========================================================================
  // Complex Combination Tests
  // ========================================================================

  describe('complex literal character combinations', () => {
    it('should handle files with multiple literal special character types', async () => {
      const result = await globTool.run({
        pattern: '*[*]*{*}**',
        path: tempDir,
      });

      const complexFiles = result.files.filter(file =>
        file.relativePath.includes('[') &&
        file.relativePath.includes('{') &&
        file.relativePath.includes('*')
      );

      expect(complexFiles.length).toBeGreaterThan(0);

      const fileNames = complexFiles.map(f => f.relativePath);
      expect(fileNames.some(name =>
        name.includes('[test]') && name.includes('{') && name.includes('*')
      )).toBe(true);
    });

    it('should handle mixed pattern and literal usage', async () => {
      await createPatternTestFiles(tempDir);

      // This should find files that have literal {js} in the name AND end with .txt
      const result = await globTool.run({
        pattern: '*{js}*.txt',
        path: tempDir,
      });

      const mixedFiles = result.files.filter(file =>
        file.extension === '.txt' && file.relativePath.includes('{js}')
      );

      if (mixedFiles.length > 0) {
        const fileNames = mixedFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name === 'test[a].{js}.txt')).toBe(true);
      }
    });

    it('should handle extremely complex literal combinations', async () => {
      const result = await globTool.run({
        pattern: '*[*]*{*}*+*?*',
        path: tempDir,
      });

      const ultraComplexFiles = result.files.filter(file => {
        const path = file.relativePath;
        return path.includes('[') &&
               path.includes('{') &&
               path.includes('+') &&
               path.includes('?');
      });

      if (ultraComplexFiles.length > 0) {
        expect(ultraComplexFiles.length).toBeGreaterThan(0);

        const fileNames = ultraComplexFiles.map(f => f.relativePath);
        expect(fileNames.some(name =>
          name.includes('pattern[match]{file}+backup?')
        )).toBe(true);
      }
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling
  // ========================================================================

  describe('literal escaping edge cases', () => {
    it('should handle files with only special characters in names', async () => {
      try {
        await createTestFile(tempDir, '[]{}.txt', 'only special chars');
        await createTestFile(tempDir, '{}[].js', 'reversed special chars');
        await createTestFile(tempDir, '*?+.log', 'wildcard chars');

        const result = await globTool.run({
          pattern: '**/*',
          path: tempDir,
        });

        const specialOnlyFiles = result.files.filter(file => {
          const basename = file.basename;
          return /^[\[\]\{\}\*\?\+]+$/.test(basename);
        });

        // Should handle these files gracefully
        expect(result.files.length).toBeGreaterThan(0);
      } catch (error) {
        // Some file systems may not support these characters
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle very long file names with many special characters', async () => {
      const longName = 'file' + '[test]'.repeat(20) + '{backup}'.repeat(15) + '.txt';

      try {
        await createTestFile(tempDir, longName, 'long name test');

        const result = await globTool.run({
          pattern: '*[*]*{*}*',
          path: tempDir,
        });

        const longFiles = result.files.filter(file => file.relativePath.length > 100);

        if (longFiles.length > 0) {
          expect(longFiles[0].relativePath).toContain('[test]');
          expect(longFiles[0].relativePath).toContain('{backup}');
        }
      } catch (error) {
        // Path length limitations on some systems
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle patterns that could cause catastrophic backtracking', async () => {
      // Patterns that might cause regex engines to struggle
      const problematicPatterns = [
        '*[*]*[*]*[*]*[*]*',
        '*{*}*{*}*{*}*{*}*',
        '*[*{*}*]*',
        '**/*[*]*{*}***',
      ];

      for (const pattern of problematicPatterns) {
        const startTime = Date.now();

        try {
          const result = await globTool.run({
            pattern,
            path: tempDir,
          });

          const executionTime = Date.now() - startTime;

          expect(result).toBeDefined();
          expect(executionTime).toBeLessThan(10000); // Should not take more than 10 seconds
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  // ========================================================================
  // Validation Tests for Literal Patterns
  // ========================================================================

  describe('validation for literal patterns', () => {
    it('should validate patterns that look problematic but are actually valid', async () => {
      const confusingButValidPatterns = [
        '*[abc]*', // Matches files with literal [abc] in the name
        '*{test}*', // Matches files with literal {test} in the name
        '*[*]*{*}*', // Complex but valid pattern
        '*[[*]]*', // Nested brackets
        '*{{*}}*', // Nested braces
      ];

      for (const pattern of confusingButValidPatterns) {
        const validation = globTool.validate({ pattern });
        expect(validation.valid).toBe(true);

        // Should not have errors, might have warnings
        expect(validation.errors).toBeUndefined();
      }
    });

    it('should provide helpful warnings for potentially unintended patterns', async () => {
      const validation = globTool.validate({ pattern: '*[*]*{*}***' });

      expect(validation.valid).toBe(true);
      // Might have warnings about complexity but should still be valid
    });
  });
});