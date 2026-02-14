/**
 * Coverage Report Validation Tests
 *
 * Tests the accuracy and reliability of JSDoc coverage reporting,
 * ensuring coverage statistics are calculated correctly and reports
 * provide meaningful insights.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { analyzeFile, analyzeFiles, type FileAnalysisResult } from '../../packages/core/src/jsdoc-detector';

describe('JSDoc Coverage Report Validation', () => {
  const testDataDir = path.join(__dirname, 'coverage-test-data');

  beforeEach(async () => {
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Coverage Statistics Accuracy', () => {
    it('should calculate 100% coverage for fully documented files', async () => {
      const fullyDocumented = `
/**
 * A comprehensive utility class for string manipulation operations.
 * Provides methods for common string transformations and validations.
 * @example
 * const utils = new StringUtils();
 * const result = utils.capitalize('hello world');
 */
export class StringUtils {
  /**
   * Capitalizes the first letter of a string
   * @param {string} input - The string to capitalize
   * @returns {string} The capitalized string
   * @throws {Error} When input is not a string
   */
  capitalize(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  }

  /**
   * Converts a string to camelCase
   * @param {string} input - The string to convert
   * @returns {string} The camelCase string
   */
  toCamelCase(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
  }
}

/**
 * Configuration options for string operations
 */
export interface StringConfig {
  /** Whether to preserve whitespace */
  preserveWhitespace: boolean;
  /** Maximum string length */
  maxLength: number;
  /** Character encoding to use */
  encoding: 'utf8' | 'ascii' | 'utf16';
}

/**
 * Default configuration for string operations
 */
export const DEFAULT_STRING_CONFIG: StringConfig = {
  preserveWhitespace: false,
  maxLength: 1000,
  encoding: 'utf8'
};

/**
 * Creates a string utility instance with configuration
 * @param {StringConfig} [config] - Optional configuration
 * @returns {StringUtils} Configured string utilities
 */
export function createStringUtils(config?: StringConfig): StringUtils {
  // Implementation would use config
  return new StringUtils();
}

/**
 * String transformation types
 */
export enum StringTransform {
  /** Convert to uppercase */
  UPPER = 'upper',
  /** Convert to lowercase */
  LOWER = 'lower',
  /** Capitalize first letter */
  CAPITALIZE = 'capitalize',
  /** Convert to camelCase */
  CAMEL = 'camel'
}
`;

      const filePath = path.join(testDataDir, 'fully-documented.ts');
      await fs.writeFile(filePath, fullyDocumented);

      const result = analyzeFile(filePath, fullyDocumented);

      expect(result.stats.coveragePercent).toBe(100);
      expect(result.stats.totalExports).toBeGreaterThan(0);
      expect(result.stats.documentedExports).toBe(result.stats.totalExports);
      expect(result.stats.undocumentedExports).toBe(0);
    });

    it('should calculate 0% coverage for completely undocumented files', async () => {
      const undocumented = `
export class UndocumentedClass {
  method1() {}
  method2() {}
}

export interface UndocumentedInterface {
  prop1: string;
  prop2: number;
}

export function undocumentedFunction() {}

export const UNDOCUMENTED_CONSTANT = 'value';

export enum UndocumentedEnum {
  VALUE1 = 'value1',
  VALUE2 = 'value2'
}

export type UndocumentedType = string | number;
`;

      const filePath = path.join(testDataDir, 'undocumented.ts');
      await fs.writeFile(filePath, undocumented);

      const result = analyzeFile(filePath, undocumented);

      expect(result.stats.coveragePercent).toBe(0);
      expect(result.stats.totalExports).toBeGreaterThan(0);
      expect(result.stats.documentedExports).toBe(0);
      expect(result.stats.undocumentedExports).toBe(result.stats.totalExports);
    });

    it('should calculate partial coverage correctly', async () => {
      const partiallyDocumented = `
/**
 * Documented function
 */
export function documentedFunction() {}

export function undocumentedFunction() {}

/**
 * Documented class
 */
export class DocumentedClass {}

export class UndocumentedClass {}

/**
 * Documented interface
 */
export interface DocumentedInterface {
  prop: string;
}

export interface UndocumentedInterface {
  prop: string;
}
`; // 3 documented out of 6 = 50%

      const filePath = path.join(testDataDir, 'partial.ts');
      await fs.writeFile(filePath, partiallyDocumented);

      const result = analyzeFile(filePath, partiallyDocumented);

      expect(result.stats.coveragePercent).toBe(50);
      expect(result.stats.totalExports).toBe(6);
      expect(result.stats.documentedExports).toBe(3);
      expect(result.stats.undocumentedExports).toBe(3);
    });

    it('should handle edge case of single export correctly', async () => {
      const singleExport = `
/**
 * Single documented export
 */
export function singleFunction() {}
`;

      const filePath = path.join(testDataDir, 'single.ts');
      await fs.writeFile(filePath, singleExport);

      const result = analyzeFile(filePath, singleExport);

      expect(result.stats.coveragePercent).toBe(100);
      expect(result.stats.totalExports).toBe(1);
      expect(result.stats.documentedExports).toBe(1);
      expect(result.stats.undocumentedExports).toBe(0);
    });

    it('should handle files with no exports', async () => {
      const noExports = `
// This file has no exports
const localVariable = 'local';

function localFunction() {
  return 'local';
}

interface LocalInterface {
  prop: string;
}
`;

      const filePath = path.join(testDataDir, 'no-exports.ts');
      await fs.writeFile(filePath, noExports);

      const result = analyzeFile(filePath, noExports);

      expect(result.stats.coveragePercent).toBe(100); // No exports = 100% coverage
      expect(result.stats.totalExports).toBe(0);
      expect(result.stats.documentedExports).toBe(0);
      expect(result.stats.undocumentedExports).toBe(0);
    });
  });

  describe('Multi-File Coverage Analysis', () => {
    it('should aggregate coverage across multiple files correctly', async () => {
      const file1 = `
/**
 * File 1 - fully documented
 */
export function func1() {}
/**
 * Another function
 */
export function func2() {}
`; // 2/2 = 100%

      const file2 = `
/**
 * File 2 - partially documented
 */
export function docFunc() {}
export function undocFunc() {}
`; // 1/2 = 50%

      const file3 = `
export function undoc1() {}
export function undoc2() {}
export function undoc3() {}
`; // 0/3 = 0%

      const files = [
        { path: path.join(testDataDir, 'file1.ts'), content: file1 },
        { path: path.join(testDataDir, 'file2.ts'), content: file2 },
        { path: path.join(testDataDir, 'file3.ts'), content: file3 }
      ];

      // Write files to disk
      for (const file of files) {
        await fs.writeFile(file.path, file.content);
      }

      const results = analyzeFiles(files);

      // Aggregate statistics
      let totalExports = 0;
      let totalDocumented = 0;

      for (const result of results) {
        totalExports += result.stats.totalExports;
        totalDocumented += result.stats.documentedExports;
      }

      const aggregateCoverage = (totalDocumented / totalExports) * 100;

      // Expected: (2 + 1 + 0) / (2 + 2 + 3) = 3/7 ≈ 42.86%
      expect(Math.round(aggregateCoverage * 100) / 100).toBeCloseTo(42.86, 2);
      expect(totalExports).toBe(7);
      expect(totalDocumented).toBe(3);
    });

    it('should filter files by extension correctly', async () => {
      const tsFile = `export function tsFunction() {}`;
      const jsFile = `export function jsFunction() {}`;
      const txtFile = `This is not a code file`;

      const files = [
        { path: 'test.ts', content: tsFile },
        { path: 'test.js', content: jsFile },
        { path: 'test.txt', content: txtFile }
      ];

      const results = analyzeFiles(files, { extensions: ['.ts'] });

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('test.ts');
    });

    it('should handle mixed file types correctly', async () => {
      const tsFile = `
/**
 * TypeScript file
 */
export function tsFunction(): string { return 'ts'; }
`;

      const jsFile = `
/**
 * JavaScript file
 */
export function jsFunction() { return 'js'; }
`;

      const files = [
        { path: 'typescript.ts', content: tsFile },
        { path: 'javascript.js', content: jsFile }
      ];

      const results = analyzeFiles(files, { extensions: ['.ts', '.js'] });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.stats.coveragePercent === 100)).toBe(true);
    });
  });

  describe('Coverage Report Details', () => {
    it('should provide detailed export information in results', async () => {
      const detailedFile = `
/**
 * Documented function
 */
export function documentedFunc() {}

export function undocumentedFunc() {}

/**
 * Documented class
 */
export class DocumentedClass {}

export interface UndocumentedInterface {}

/**
 * Documented constant
 */
export const DOCUMENTED_CONST = 'value';
`;

      const filePath = path.join(testDataDir, 'detailed.ts');
      await fs.writeFile(filePath, detailedFile);

      const result = analyzeFile(filePath, detailedFile);

      expect(result.exports).toHaveLength(5);
      expect(result.documentation).toHaveLength(5);

      // Check documented exports
      const documentedItems = result.documentation.filter(d => d.isDocumented);
      expect(documentedItems).toHaveLength(3);

      const documentedNames = documentedItems.map(d => d.export.name);
      expect(documentedNames).toEqual(expect.arrayContaining([
        'documentedFunc',
        'DocumentedClass',
        'DOCUMENTED_CONST'
      ]));

      // Check undocumented exports
      const undocumentedItems = result.documentation.filter(d => !d.isDocumented);
      expect(undocumentedItems).toHaveLength(2);

      const undocumentedNames = undocumentedItems.map(d => d.export.name);
      expect(undocumentedNames).toEqual(expect.arrayContaining([
        'undocumentedFunc',
        'UndocumentedInterface'
      ]));
    });

    it('should track different export kinds correctly', async () => {
      const exportKinds = `
/**
 * Function export
 */
export function testFunction() {}

/**
 * Class export
 */
export class TestClass {}

/**
 * Interface export
 */
export interface TestInterface {}

/**
 * Type export
 */
export type TestType = string;

/**
 * Const export
 */
export const TEST_CONST = 'value';

/**
 * Enum export
 */
export enum TestEnum {
  VALUE = 'value'
}
`;

      const filePath = path.join(testDataDir, 'export-kinds.ts');
      await fs.writeFile(filePath, exportKinds);

      const result = analyzeFile(filePath, exportKinds);

      const exportKindCounts = result.exports.reduce((counts, exp) => {
        counts[exp.kind] = (counts[exp.kind] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      expect(exportKindCounts.function).toBe(1);
      expect(exportKindCounts.class).toBe(1);
      expect(exportKindCounts.interface).toBe(1);
      expect(exportKindCounts.type).toBe(1);
      expect(exportKindCounts.const).toBe(1);
      expect(exportKindCounts.enum).toBe(1);

      expect(result.stats.coveragePercent).toBe(100);
    });

    it('should provide suggestions for improvement', async () => {
      const improvementFile = `
export function needsDocumentation() {}

/**
 * Short
 */
export function needsLongerDescription() {}

/**
 * Function with parameters but no @param tags
 */
export function needsParamTags(a: string, b: number) {}
`;

      const filePath = path.join(testDataDir, 'improvement.ts');
      await fs.writeFile(filePath, improvementFile);

      const result = analyzeFile(filePath, improvementFile, {
        minSummaryLength: 20
      });

      // Check that suggestions are provided
      const allSuggestions = result.documentation.flatMap(d => d.suggestions);
      expect(allSuggestions.length).toBeGreaterThan(0);

      // Should suggest adding JSDoc
      expect(allSuggestions.some(s => s.includes('Add JSDoc comment'))).toBe(true);

      // Should suggest expanding description
      expect(allSuggestions.some(s => s.includes('Expand the description'))).toBe(true);

      // Should suggest param tags
      expect(allSuggestions.some(s => s.includes('@param'))).toBe(true);
    });
  });

  describe('Coverage Report Edge Cases', () => {
    it('should handle malformed JSDoc gracefully', async () => {
      const malformedJSDoc = `
/**
 * Incomplete JSDoc without closing
export function testFunction() {}

/**
 * Another function with proper JSDoc
 */
export function properFunction() {}
`;

      const filePath = path.join(testDataDir, 'malformed.ts');
      await fs.writeFile(filePath, malformedJSDoc);

      const result = analyzeFile(filePath, malformedJSDoc);

      expect(result.stats.totalExports).toBe(2);
      // Should handle malformed JSDoc gracefully
      expect(result.stats.documentedExports).toBe(1); // Only the proper one
      expect(result.stats.coveragePercent).toBe(50);
      expect(result.errors).toHaveLength(0); // Should not crash
    });

    it('should handle complex export patterns', async () => {
      const complexExports = `
// Default export
/**
 * Default exported class
 */
export default class DefaultClass {}

// Re-exports
export { Helper1, Helper2 } from './helpers';

// Export with alias
const InternalFunction = () => {};
/**
 * Aliased export
 */
export { InternalFunction as ExternalFunction };

// Namespace export
export * as Utils from './utils';
`;

      const filePath = path.join(testDataDir, 'complex-exports.ts');
      await fs.writeFile(filePath, complexExports);

      const result = analyzeFile(filePath, complexExports, {
        includeReExports: true
      });

      expect(result.stats.totalExports).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Should detect some documented exports
      expect(result.stats.documentedExports).toBeGreaterThan(0);
    });

    it('should respect configuration filters', async () => {
      const filteredFile = `
/**
 * Public function
 */
export function publicFunction() {}

/**
 * Private function (underscore prefix)
 */
export function _privateFunction() {}

/**
 * Re-exported utility
 */
export { utility } from './utils';
`;

      const filePath = path.join(testDataDir, 'filtered.ts');
      await fs.writeFile(filePath, filteredFile);

      // Test with private functions excluded
      const withoutPrivate = analyzeFile(filePath, filteredFile, {
        includePrivate: false,
        includeReExports: true
      });

      // Test with re-exports excluded
      const withoutReExports = analyzeFile(filePath, filteredFile, {
        includePrivate: true,
        includeReExports: false
      });

      // Test with both excluded
      const withoutBoth = analyzeFile(filePath, filteredFile, {
        includePrivate: false,
        includeReExports: false
      });

      expect(withoutPrivate.stats.totalExports).toBe(2);
      expect(withoutReExports.stats.totalExports).toBe(2);
      expect(withoutBoth.stats.totalExports).toBe(1);
    });
  });

  describe('Coverage Report Performance', () => {
    it('should handle large files efficiently', async () => {
      // Generate a large file with many exports
      let largeFile = '';
      for (let i = 1; i <= 100; i++) {
        if (i % 3 === 0) {
          largeFile += `/**
 * Documented function ${i}
 */
export function func${i}() {}

`;
        } else {
          largeFile += `export function func${i}() {}
`;
        }
      }

      const filePath = path.join(testDataDir, 'large-file.ts');
      await fs.writeFile(filePath, largeFile);

      const startTime = Date.now();
      const result = analyzeFile(filePath, largeFile);
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      expect(result.stats.totalExports).toBe(100);
      expect(result.stats.documentedExports).toBe(33); // Every 3rd function
      expect(Math.round(result.stats.coveragePercent)).toBe(33);
    });

    it('should handle many small files efficiently', async () => {
      const files = [];

      // Generate many small files
      for (let i = 1; i <= 50; i++) {
        const content = `
/**
 * Function in file ${i}
 */
export function fileFunc${i}() {}
`;
        files.push({
          path: path.join(testDataDir, `file${i}.ts`),
          content
        });
      }

      const startTime = Date.now();
      const results = analyzeFiles(files);
      const endTime = Date.now();

      // Should complete in reasonable time (< 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);

      expect(results).toHaveLength(50);
      expect(results.every(r => r.stats.coveragePercent === 100)).toBe(true);
    });
  });
});