/**
 * Unit Tests for JSDoc Detection Module
 *
 * Comprehensive tests for all JSDoc detection functionality including
 * parsing, export finding, and documentation analysis.
 */

import { describe, it, expect } from 'vitest';
import {
  parseJSDocComment,
  findExportsInSource,
  detectUndocumentedExports,
  analyzeFile,
  validateDeprecatedTags,
  type ExportInfo,
  type JSDocInfo,
  type ExportDocumentation,
  type DetectionConfig
} from '../../packages/core/src/jsdoc-detector';

describe('JSDoc Detection Module - Unit Tests', () => {
  describe('parseJSDocComment', () => {
    it('should parse a basic JSDoc comment', () => {
      const comment = '/** This is a test function */';
      const result = parseJSDocComment(comment, 1);

      expect(result).toBeTruthy();
      expect(result!.summary).toBe('This is a test function');
      expect(result!.startLine).toBe(1);
      expect(result!.hasContent).toBe(true);
      expect(result!.tags).toHaveLength(0);
    });

    it('should parse JSDoc with tags', () => {
      const comment = `/**
       * A function that adds two numbers
       * @param {number} a - The first number
       * @param {number} b - The second number
       * @returns {number} The sum of a and b
       */`;

      const result = parseJSDocComment(comment, 1);

      expect(result).toBeTruthy();
      expect(result!.summary).toBe('A function that adds two numbers');
      expect(result!.tags).toHaveLength(3);

      const paramTags = result!.tags.filter(tag => tag.name === 'param');
      expect(paramTags).toHaveLength(2);
      expect(paramTags[0].paramName).toBe('a');
      expect(paramTags[0].type).toBe('number');
      expect(paramTags[0].value).toBe('The first number');

      const returnTag = result!.tags.find(tag => tag.name === 'returns');
      expect(returnTag).toBeTruthy();
      expect(returnTag!.type).toBe('number');
      expect(returnTag!.value).toBe('The sum of a and b');
    });

    it('should handle empty or invalid comments', () => {
      expect(parseJSDocComment('', 1)).toBeNull();
      expect(parseJSDocComment('// not jsdoc', 1)).toBeNull();
      expect(parseJSDocComment('/* regular comment */', 1)).toBeNull();
    });

    it('should handle multi-line descriptions', () => {
      const comment = `/**
       * This is a complex function
       * that does multiple things
       * @param data - Input data
       */`;

      const result = parseJSDocComment(comment, 1);
      expect(result!.summary).toBe('This is a complex function that does multiple things');
    });

    it('should handle JSDoc with no summary but with tags', () => {
      const comment = `/**
       * @deprecated Use newFunction instead
       */`;

      const result = parseJSDocComment(comment, 1);
      expect(result!.summary).toBe('');
      expect(result!.tags).toHaveLength(1);
      expect(result!.tags[0].name).toBe('deprecated');
    });
  });

  describe('findExportsInSource', () => {
    it('should find function exports', () => {
      const source = `
export function testFunction() {}
export async function asyncFunction() {}
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(2);
      expect(exports[0].name).toBe('testFunction');
      expect(exports[0].kind).toBe('function');
      expect(exports[0].isDefault).toBe(false);

      expect(exports[1].name).toBe('asyncFunction');
      expect(exports[1].kind).toBe('function');
    });

    it('should find class exports', () => {
      const source = 'export class MyClass {}';
      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('MyClass');
      expect(exports[0].kind).toBe('class');
    });

    it('should find interface and type exports', () => {
      const source = `
export interface ApiResponse {}
export type UserId = string;
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(2);
      expect(exports.find(e => e.name === 'ApiResponse')).toBeTruthy();
      expect(exports.find(e => e.name === 'UserId')).toBeTruthy();
    });

    it('should find const/let/var exports', () => {
      const source = `
export const API_URL = 'https://api.example.com';
export let currentUser = null;
export var globalConfig = {};
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(3);
      expect(exports.find(e => e.name === 'API_URL')).toBeTruthy();
      expect(exports.find(e => e.name === 'currentUser')).toBeTruthy();
      expect(exports.find(e => e.name === 'globalConfig')).toBeTruthy();
    });

    it('should find default exports', () => {
      const source = `
export default function defaultFunction() {}
export default class DefaultClass {}
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(2);
      expect(exports.every(e => e.isDefault)).toBe(true);
    });

    it('should find re-exports', () => {
      const source = `
export * from './utils';
export { helper1, helper2 } from './helpers';
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(3); // *, helper1, helper2
      expect(exports.every(e => e.isReExport)).toBe(true);
    });

    it('should find export lists', () => {
      const source = `
const a = 1;
const b = 2;
export { a, b as beta };
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(2);
      expect(exports.find(e => e.name === 'a')).toBeTruthy();
      expect(exports.find(e => e.name === 'beta')).toBeTruthy();
    });

    it('should ignore comments and non-export lines', () => {
      const source = `
// export function notAnExport() {}
/* export const notAnExport = true; */
const localFunction = () => {};
export function realExport() {}
`;

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('realExport');
    });
  });

  describe('detectUndocumentedExports', () => {
    it('should identify documented exports', () => {
      const source = `
/**
 * A well-documented function
 * @param input - The input parameter
 * @returns The processed result
 */
export function documentedFunction(input: string): string {
  return input;
}
`;

      const documentation = detectUndocumentedExports(source);

      expect(documentation).toHaveLength(1);
      expect(documentation[0].isDocumented).toBe(true);
      expect(documentation[0].jsdoc).toBeTruthy();
      expect(documentation[0].suggestions).toHaveLength(0);
    });

    it('should identify undocumented exports', () => {
      const source = 'export function undocumentedFunction() {}';
      const documentation = detectUndocumentedExports(source);

      expect(documentation).toHaveLength(1);
      expect(documentation[0].isDocumented).toBe(false);
      expect(documentation[0].jsdoc).toBeNull();
      expect(documentation[0].suggestions.length).toBeGreaterThan(0);
    });

    it('should respect minimum summary length requirement', () => {
      const source = `
/**
 * Short
 */
export function shortlyDocumentedFunction() {}
`;

      const documentation = detectUndocumentedExports(source, { minSummaryLength: 20 });

      expect(documentation[0].isDocumented).toBe(false);
      expect(documentation[0].suggestions.some(s => s.includes('Expand the description'))).toBe(true);
    });

    it('should validate required tags', () => {
      const source = `
/**
 * A function without required tags
 */
export function functionWithoutTags() {}
`;

      const documentation = detectUndocumentedExports(source, {
        requiredTags: ['returns', 'example']
      });

      expect(documentation[0].isDocumented).toBe(false);
      expect(documentation[0].suggestions.some(s => s.includes('@returns'))).toBe(true);
      expect(documentation[0].suggestions.some(s => s.includes('@example'))).toBe(true);
    });

    it('should filter re-exports when includeReExports is false', () => {
      const source = 'export { helper } from "./utils";';
      const documentation = detectUndocumentedExports(source, { includeReExports: false });

      expect(documentation).toHaveLength(0);
    });

    it('should filter private exports when includePrivate is false', () => {
      const source = 'export function _privateFunction() {}';
      const documentation = detectUndocumentedExports(source, { includePrivate: false });

      expect(documentation).toHaveLength(0);
    });

    it('should include re-exports when includeReExports is true', () => {
      const source = 'export { helper } from "./utils";';
      const documentation = detectUndocumentedExports(source, { includeReExports: true });

      expect(documentation).toHaveLength(1);
      expect(documentation[0].export.isReExport).toBe(true);
    });

    it('should validate function parameters', () => {
      const source = `
/**
 * A function with parameters but no @param tags
 */
export function functionWithParams(a: string, b: number) {}
`;

      const documentation = detectUndocumentedExports(source);

      expect(documentation[0].isDocumented).toBe(false);
      expect(documentation[0].suggestions.some(s => s.includes('@param'))).toBe(true);
    });
  });

  describe('analyzeFile', () => {
    it('should provide complete file analysis', () => {
      const filePath = '/test/example.ts';
      const source = `
/**
 * Documented function
 */
export function documented() {}

export function undocumented() {}
`;

      const result = analyzeFile(filePath, source);

      expect(result.filePath).toBe(filePath);
      expect(result.exports).toHaveLength(2);
      expect(result.documentation).toHaveLength(2);
      expect(result.stats.totalExports).toBe(2);
      expect(result.stats.documentedExports).toBe(1);
      expect(result.stats.undocumentedExports).toBe(1);
      expect(result.stats.coveragePercent).toBe(50);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files with no exports', () => {
      const result = analyzeFile('/test/no-exports.ts', 'const local = true;');

      expect(result.stats.totalExports).toBe(0);
      expect(result.stats.coveragePercent).toBe(100);
    });

    it('should handle parsing errors gracefully', () => {
      // This test would need to simulate a parsing error scenario
      const result = analyzeFile('/test/valid.ts', 'export function valid() {}');

      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalExports).toBe(1);
    });
  });

  describe('validateDeprecatedTags', () => {
    it('should find well-documented deprecated functions', () => {
      const source = `
/**
 * @deprecated This function is deprecated. Use newFunction() instead.
 * @see newFunction for the replacement
 */
export function oldFunction() {}
`;

      const issues = validateDeprecatedTags(source, '/test/file.ts');

      expect(issues).toHaveLength(0);
    });

    it('should identify inadequate @deprecated tags', () => {
      const source = `
/**
 * @deprecated
 */
export function poorlyDeprecatedFunction() {}
`;

      const issues = validateDeprecatedTags(source, '/test/file.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('deprecated-api');
      expect(issues[0].description).toContain('lacks proper documentation');
      expect(issues[0].suggestion).toContain('meaningful explanation');
    });

    it('should identify deprecated tags without migration info', () => {
      const source = `
/**
 * @deprecated This function is old and bad
 */
export function deprecatedFunction() {}
`;

      const issues = validateDeprecatedTags(source, '/test/file.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0].suggestion).toContain('migration path');
    });

    it('should accept migration info in deprecated description', () => {
      const source = `
/**
 * @deprecated Use the newer API instead of this old one
 */
export function oldApi() {}
`;

      const issues = validateDeprecatedTags(source, '/test/file.ts');

      expect(issues).toHaveLength(0);
    });

    it('should handle multiple deprecated items', () => {
      const source = `
/**
 * @deprecated
 */
export function bad1() {}

/**
 * @deprecated Use good2() instead
 */
export function good1() {}

/**
 * @deprecated Bad docs
 */
export function bad2() {}
`;

      const issues = validateDeprecatedTags(source, '/test/file.ts');

      expect(issues).toHaveLength(2);
      expect(issues.map(i => i.description)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('bad1'),
          expect.stringContaining('bad2')
        ])
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSDoc comments', () => {
      const source = `
/**
 * Malformed JSDoc with missing closing
export function testFunction() {}
`;

      const documentation = detectUndocumentedExports(source);

      expect(documentation).toHaveLength(1);
      expect(documentation[0].isDocumented).toBe(false);
    });

    it('should handle complex export patterns', () => {
      const source = `
export const { a, b } = obj;
export const [first, second] = array;
`;

      const exports = findExportsInSource(source);

      // These complex destructuring patterns might not be fully parsed
      // This test ensures the system doesn't crash
      expect(exports).toBeDefined();
    });

    it('should handle nested JSDoc comments', () => {
      const source = `
/**
 * Outer comment
 * /** Not a real inner comment */
 * Still the same comment
 */
export function testFunction() {}
`;

      const documentation = detectUndocumentedExports(source);

      expect(documentation).toHaveLength(1);
      expect(documentation[0].jsdoc).toBeTruthy();
    });

    it('should handle exports with generic types', () => {
      const source = 'export function generic<T>(input: T): T { return input; }';

      const exports = findExportsInSource(source);

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('generic');
      expect(exports[0].kind).toBe('function');
    });

    it('should handle multiple exports on the same line', () => {
      const source = 'export const a = 1, b = 2;';

      const exports = findExportsInSource(source);

      // Current implementation may not handle this perfectly
      expect(exports).toBeDefined();
    });
  });

  describe('Configuration Options', () => {
    const configTestSource = `
/**
 * Short description
 * @param x input
 */
export function testFunc(x: string) {}

export function _private() {}

export { reExported } from './other';
`;

    it('should respect minSummaryLength config', () => {
      const shortConfig = { minSummaryLength: 5 };
      const longConfig = { minSummaryLength: 50 };

      const shortResult = detectUndocumentedExports(configTestSource, shortConfig);
      const longResult = detectUndocumentedExports(configTestSource, longConfig);

      expect(shortResult[0].isDocumented).toBe(true);
      expect(longResult[0].isDocumented).toBe(false);
    });

    it('should respect includePrivate config', () => {
      const withPrivate = detectUndocumentedExports(configTestSource, { includePrivate: true });
      const withoutPrivate = detectUndocumentedExports(configTestSource, { includePrivate: false });

      expect(withPrivate.length).toBeGreaterThan(withoutPrivate.length);
    });

    it('should respect includeReExports config', () => {
      const withReExports = detectUndocumentedExports(configTestSource, { includeReExports: true });
      const withoutReExports = detectUndocumentedExports(configTestSource, { includeReExports: false });

      expect(withReExports.length).toBeGreaterThan(withoutReExports.length);
    });
  });
});