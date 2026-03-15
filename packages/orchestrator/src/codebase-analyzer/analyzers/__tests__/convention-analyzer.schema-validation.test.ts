/**
 * ConventionAnalyzer Schema Validation Tests
 *
 * Focused tests to validate that ConventionAnalysis output always conforms to the schema
 * regardless of input variations. Tests edge cases, malformed input, and boundary conditions.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema, type ConventionAnalysis } from '@apexcli/core';

// Get the current file's directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ConventionAnalyzer Schema Validation Tests', () => {
  let analyzer: ConventionAnalyzer;
  let tempTestDir: string;

  beforeAll(() => {
    analyzer = new ConventionAnalyzer();
  });

  beforeEach(async () => {
    // Create unique temporary directory for each test
    tempTestDir = join(tmpdir(), `convention-schema-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempTestDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Required Fields Schema Validation', () => {
    it('should always include all required fields in output', async () => {
      const minimalFile = `function test() { return 'hello'; }`;
      await fs.writeFile(join(tempTestDir, 'minimal.js'), minimalFile);

      const result = await analyzer.analyze(tempTestDir);

      // Strict schema parsing should not throw
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // All required fields must be present
      expect(result).toHaveProperty('fileNaming');
      expect(result).toHaveProperty('functionNaming');
      expect(result).toHaveProperty('variableNaming');
      expect(result).toHaveProperty('indentation');
      expect(result).toHaveProperty('imports');
      expect(result).toHaveProperty('documentation');

      // Required nested fields must be present
      expect(result.indentation).toHaveProperty('type');
      expect(result.imports).toHaveProperty('style');
      expect(result.documentation).toHaveProperty('style');
      expect(result.documentation).toHaveProperty('coverage');

      // Validate enum constraints
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']).toContain(result.variableNaming);
      expect(['spaces', 'tabs', 'mixed']).toContain(result.indentation.type);
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(result.imports.style);
      expect(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']).toContain(result.documentation.style);

      // Coverage must be valid percentage
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.documentation.coverage)).toBe(true);
    });

    it('should handle empty project with valid schema output', async () => {
      // Empty directory
      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should have meaningful defaults
      expect(result.fileNaming).toBe('mixed');
      expect(result.functionNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
      expect(result.documentation.coverage).toBe(0);
      expect(result.documentation.style).toBe('none');
    });

    it('should validate indentation field constraints', async () => {
      const testFiles = [
        { name: 'tabs.js', content: 'function test() {\n\treturn "tabs";\n}' },
        { name: 'spaces.js', content: 'function test() {\n  return "spaces";\n}' },
        { name: 'mixed.js', content: 'function test() {\n\t  return "mixed";\n}' },
      ];

      for (const file of testFiles) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Indentation type must be valid
      expect(['spaces', 'tabs', 'mixed']).toContain(result.indentation.type);

      // Size constraints
      if (result.indentation.size !== undefined) {
        expect(result.indentation.size).toBeGreaterThanOrEqual(1);
        expect(result.indentation.size).toBeLessThanOrEqual(8);
        expect(Number.isInteger(result.indentation.size)).toBe(true);
      }
    });
  });

  describe('Optional Fields Schema Validation', () => {
    it('should properly handle optional classNaming field', async () => {
      // File without classes
      const noClassFile = `
function regularFunction() {
  const variable = 'value';
  return variable;
}
`;

      await fs.writeFile(join(tempTestDir, 'noclass.js'), noClassFile);
      const resultNoClass = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(resultNoClass)).not.toThrow();
      expect(resultNoClass.classNaming).toBeUndefined();

      // File with classes
      const classFile = `
class TestClass {
  constructor() {
    this.value = 'test';
  }
}
`;

      await fs.writeFile(join(tempTestDir, 'withclass.js'), classFile);
      const resultWithClass = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(resultWithClass)).not.toThrow();

      if (resultWithClass.classNaming !== undefined) {
        expect(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).toContain(resultWithClass.classNaming);
      }
    });

    it('should properly handle optional constantNaming field', async () => {
      // File without constants
      const noConstantFile = `
let variable = 'value';
function test() { return variable; }
`;

      await fs.writeFile(join(tempTestDir, 'noconstant.js'), noConstantFile);
      const resultNoConstant = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(resultNoConstant)).not.toThrow();
      expect(resultNoConstant.constantNaming).toBeUndefined();

      // File with constants
      const constantFile = `
const CONSTANT_VALUE = 'test';
const another_constant = 'another';
`;

      await fs.writeFile(join(tempTestDir, 'withconstant.js'), constantFile);
      const resultWithConstant = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(resultWithConstant)).not.toThrow();

      if (resultWithConstant.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(resultWithConstant.constantNaming);
      }
    });

    it('should properly handle optional formatting field', async () => {
      const jsFile = `
function testFunction() {
  const message = 'hello world';
  const array = [1, 2, 3,];
  return message;
}
`;

      await fs.writeFile(join(tempTestDir, 'formatting.js'), jsFile);
      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      if (result.formatting !== undefined) {
        // All formatting subfields are optional
        if (result.formatting.lineLength !== undefined) {
          expect(result.formatting.lineLength).toBeGreaterThanOrEqual(40);
          expect(result.formatting.lineLength).toBeLessThanOrEqual(200);
          expect(Number.isInteger(result.formatting.lineLength)).toBe(true);
        }

        if (result.formatting.semicolons !== undefined) {
          expect(['required', 'optional', 'mixed']).toContain(result.formatting.semicolons);
        }

        if (result.formatting.quotes !== undefined) {
          expect(['single', 'double', 'backtick', 'mixed']).toContain(result.formatting.quotes);
        }

        if (result.formatting.trailingCommas !== undefined) {
          expect(['always', 'never', 'es5', 'mixed']).toContain(result.formatting.trailingCommas);
        }
      }
    });

    it('should properly handle optional organization field', async () => {
      // Create project structure with tests
      const srcDir = join(tempTestDir, 'src');
      const testDir = join(tempTestDir, '__tests__');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });

      await fs.writeFile(join(srcDir, 'service.js'), 'export function service() { return "test"; }');
      await fs.writeFile(join(testDir, 'service.test.js'), 'test("service", () => {});');

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      if (result.organization !== undefined) {
        expect(['colocated', 'separate-tests', 'separate-__tests__', 'mixed']).toContain(result.organization.testLocation);
        expect(['suffix-.test', 'suffix-.spec', 'suffix-Test', 'prefix-test-', 'mixed']).toContain(result.organization.testNaming);
        expect(['src', 'lib', 'app', 'source', 'root-level', 'mixed']).toContain(result.organization.sourceStructure);

        if (result.organization.configLocation !== undefined) {
          expect(['root', 'config-dir', 'mixed']).toContain(result.organization.configLocation);
        }
      }
    });

    it('should handle optional import grouping and quotes fields', async () => {
      const importFile = `
import { readFile } from 'fs';
import path from "path";
import type { User } from './types';

export function processFile() {
  return readFile;
}
`;

      await fs.writeFile(join(tempTestDir, 'imports.ts'), importFile);
      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // imports.style is required
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(result.imports.style);

      // quotes and grouping are optional
      if (result.imports.quotes !== undefined) {
        expect(['single', 'double', 'mixed']).toContain(result.imports.quotes);
      }

      if (result.imports.grouping !== undefined) {
        expect(['none', 'type-separate', 'source-separate', 'alphabetical', 'custom']).toContain(result.imports.grouping);
      }
    });
  });

  describe('Edge Case Schema Validation', () => {
    it('should handle files with unusual characters and maintain schema validity', async () => {
      const weirdFiles = [
        { name: 'ünicöde-file.js', content: 'const ünicödeVar = "test";' },
        { name: 'file.with.dots.js', content: 'function test() { return "dots"; }' },
        { name: 'file_with_underscores.ts', content: 'export const test = 1;' },
        { name: 'file-with-dashes.jsx', content: 'const Test = () => <div>test</div>;' },
        { name: 'UPPERCASE.JS', content: 'function UPPERCASE() { return "CAPS"; }' },
      ];

      for (const file of weirdFiles) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should handle mixed naming patterns
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent', 'camelCase']).toContain(result.functionNaming);
    });

    it('should handle extremely long lines and maintain formatting constraints', async () => {
      const longLineFile = `
function extremelyLongFunctionNameThatGoesOnAndOnAndOnAndShouldTestLineLengthDetection() {
  const reallyLongVariableNameThatExceedsNormalLineLengthLimitsByALotAndShouldBeDetectedByTheAnalyzer = 'This is a really long string that also contributes to making this line extremely long and should be detected by the line length analysis functionality';
  return reallyLongVariableNameThatExceedsNormalLineLengthLimitsByALotAndShouldBeDetectedByTheAnalyzer;
}
`;

      await fs.writeFile(join(tempTestDir, 'longlines.js'), longLineFile);
      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      if (result.formatting?.lineLength !== undefined) {
        expect(result.formatting.lineLength).toBeGreaterThanOrEqual(40);
        expect(result.formatting.lineLength).toBeLessThanOrEqual(200);
        expect(Number.isInteger(result.formatting.lineLength)).toBe(true);
      }
    });

    it('should handle files with no analyzable content', async () => {
      const emptyFiles = [
        { name: 'empty.js', content: '' },
        { name: 'comments-only.js', content: '// Just comments\n/* Nothing else */\n// More comments' },
        { name: 'whitespace.js', content: '   \n\t\n   \n\t\t   ' },
      ];

      for (const file of emptyFiles) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should have valid defaults for empty content
      expect(['mixed', 'camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'inconsistent']).toContain(result.fileNaming);
      expect(result.documentation.coverage).toBe(0);
      expect(result.documentation.style).toBe('none');
    });

    it('should validate all possible enum value combinations', async () => {
      // Create files that could trigger different enum combinations
      const files = [
        { name: 'camelCase.js', content: 'function camelCase() { const camelVar = 1; }' },
        { name: 'PascalCase.js', content: 'function PascalCase() { const PascalVar = 1; }' },
        { name: 'kebab-case.js', content: 'function kebabCase() { const kebabVar = 1; }' },
        { name: 'snake_case.js', content: 'function snake_case() { const snake_var = 1; }' },
      ];

      for (const file of files) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // All enum values should be within allowed ranges
      const fileNamingValues = ['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent'];
      const functionNamingValues = ['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent'];
      const variableNamingValues = ['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent'];

      expect(fileNamingValues).toContain(result.fileNaming);
      expect(functionNamingValues).toContain(result.functionNaming);
      expect(variableNamingValues).toContain(result.variableNaming);
    });
  });

  describe('Boundary Value Schema Validation', () => {
    it('should validate indentation size boundaries', async () => {
      const tabFiles = Array.from({ length: 3 }, (_, i) => ({
        name: `tab${i + 1}.js`,
        content: `function test${i + 1}() {\n${'\t'.repeat(i + 1)}return ${i + 1};\n}`
      }));

      const spaceFiles = Array.from({ length: 8 }, (_, i) => ({
        name: `space${i + 1}.js`,
        content: `function test${i + 1}() {\n${' '.repeat(i + 1)}return ${i + 1};\n}`
      }));

      for (const file of [...tabFiles, ...spaceFiles]) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      if (result.indentation.size !== undefined) {
        expect(result.indentation.size).toBeGreaterThanOrEqual(1);
        expect(result.indentation.size).toBeLessThanOrEqual(8);
        expect(Number.isInteger(result.indentation.size)).toBe(true);
      }
    });

    it('should validate documentation coverage boundaries', async () => {
      const documentedFile = `
/**
 * Documented function
 * @param value - Input value
 * @returns Processed value
 */
function documentedFunction(value) {
  /**
   * Inner documented function
   */
  function innerFunction() {
    return 'inner';
  }

  return value + innerFunction();
}

/**
 * Another documented function
 */
function anotherDocumentedFunction() {
  return 'documented';
}

// Undocumented function
function undocumentedFunction() {
  return 'undocumented';
}
`;

      await fs.writeFile(join(tempTestDir, 'documentation.js'), documentedFile);
      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Coverage must be valid percentage
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.documentation.coverage)).toBe(true);

      // Should be greater than 0 for documented content
      expect(result.documentation.coverage).toBeGreaterThan(0);
    });

    it('should validate line length boundaries', async () => {
      const shortLineFile = `
function test() {
  return 1;
}
`;

      const mediumLineFile = `
function mediumLengthFunctionName() {
  const mediumLengthVariableName = 'medium length string value';
  return mediumLengthVariableName;
}
`;

      const longLineFile = `
function extremelyLongFunctionNameThatExceedsTypicalLineLengthLimits() {
  const extremelyLongVariableNameThatAlsoExceedsTypicalLimits = 'This is an extremely long string literal that contributes to making this line very long';
  return extremelyLongVariableNameThatAlsoExceedsTypicalLimits.toUpperCase();
}
`;

      await fs.writeFile(join(tempTestDir, 'short.js'), shortLineFile);
      await fs.writeFile(join(tempTestDir, 'medium.js'), mediumLineFile);
      await fs.writeFile(join(tempTestDir, 'long.js'), longLineFile);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      if (result.formatting?.lineLength !== undefined) {
        expect(result.formatting.lineLength).toBeGreaterThanOrEqual(40);
        expect(result.formatting.lineLength).toBeLessThanOrEqual(200);
        expect(Number.isInteger(result.formatting.lineLength)).toBe(true);
      }
    });
  });

  describe('Schema Consistency Validation', () => {
    it('should maintain schema consistency across multiple analysis runs', async () => {
      const consistentFile = `
/**
 * Consistent test function
 * @param input - Test input
 * @returns Test output
 */
export function consistentTest(input: string): string {
  const CONSTANT_VALUE = 'CONSTANT';
  const processedInput = input.trim();
  return processedInput + CONSTANT_VALUE;
}

export class ConsistentClass {
  private readonly instanceVariable: string;

  constructor(value: string) {
    this.instanceVariable = value;
  }

  public getInstanceVariable(): string {
    return this.instanceVariable;
  }
}
`;

      await fs.writeFile(join(tempTestDir, 'consistent.ts'), consistentFile);

      // Run analysis multiple times
      const results = await Promise.all([
        analyzer.analyze(tempTestDir),
        analyzer.analyze(tempTestDir),
        analyzer.analyze(tempTestDir)
      ]);

      // All results should pass schema validation
      results.forEach(result => {
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      });

      // Results should be identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);

      // Specific consistency checks
      const [firstResult] = results;
      expect(firstResult.fileNaming).toBe('camelCase');
      expect(firstResult.functionNaming).toBe('camelCase');
      expect(firstResult.classNaming).toBe('PascalCase');
      expect(firstResult.constantNaming).toBe('SCREAMING_SNAKE_CASE');
      expect(firstResult.imports.style).toBe('es6');
      expect(['jsdoc', 'tsdoc']).toContain(firstResult.documentation.style);
      expect(firstResult.documentation.coverage).toBeGreaterThan(60);
    });

    it('should handle concurrent analysis while maintaining schema validity', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent${i}.js`,
        content: `
function concurrentFunction${i}() {
  const concurrentVar${i} = 'concurrent${i}';
  return concurrentVar${i};
}
`
      }));

      for (const file of files) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      // Run multiple concurrent analyses
      const promises = Array.from({ length: 5 }, () => analyzer.analyze(tempTestDir));
      const results = await Promise.all(promises);

      // All results should pass schema validation
      results.forEach(result => {
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      });

      // All results should be identical (deterministic analysis)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
    });
  });
});