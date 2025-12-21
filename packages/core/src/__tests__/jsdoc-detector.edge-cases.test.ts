import { describe, it, expect } from 'vitest';
import {
  parseJSDocComment,
  findExportsInSource,
  detectUndocumentedExports,
  analyzeFile,
  analyzeFiles,
  type ExportInfo,
  type JSDocInfo,
  type ExportDocumentation,
  type DetectionConfig,
} from '../jsdoc-detector.js';

describe('JSDoc Detector - Edge Cases and Advanced Scenarios', () => {
  describe('parseJSDocComment - Advanced Edge Cases', () => {
    it('handles malformed JSDoc comments', () => {
      const malformedComments = [
        '/** Unclosed comment',
        '/* Missing double star */',
        '/**/',
        '/** \n * \n */',
        '/** @invalid-tag-with-no-content */',
      ];

      malformedComments.forEach(comment => {
        const result = parseJSDocComment(comment, 1);
        if (result) {
          expect(result.raw).toBe(comment);
        }
      });
    });

    it('parses nested types in JSDoc tags', () => {
      const comment = `/**
       * Complex function with nested types
       * @param {Array<{id: number, data: {nested: boolean}}>} items - Complex array param
       * @param {{foo: string, bar?: number}} options - Options object
       * @returns {Promise<{success: boolean, data?: any}>} Promise with complex return type
       */`;

      const result = parseJSDocComment(comment, 1);
      expect(result).not.toBeNull();
      expect(result!.tags).toHaveLength(3);
      expect(result!.tags[0].type).toBe('Array<{id: number, data: {nested: boolean}}>');
      expect(result!.tags[1].type).toBe('{foo: string, bar?: number}');
      expect(result!.tags[2].type).toBe('Promise<{success: boolean, data?: any}>');
    });

    it('handles JSDoc with multiple paragraph descriptions', () => {
      const comment = `/**
       * This is the first paragraph of a long description.
       * It continues on multiple lines.
       *
       * This is a second paragraph after an empty line.
       *
       * And here's a third paragraph.
       * @param data The input data
       */`;

      const result = parseJSDocComment(comment, 1);
      expect(result).not.toBeNull();
      expect(result!.summary).toBe(
        'This is the first paragraph of a long description. It continues on multiple lines.'
      );
      expect(result!.tags).toHaveLength(1);
    });

    it('preserves complex tag descriptions with special characters', () => {
      const comment = `/**
       * @example
       * ```typescript
       * const result = myFunction({
       *   key: "value",
       *   numbers: [1, 2, 3]
       * });
       * console.log(result?.data);
       * ```
       * @deprecated Since v2.0.0. Use newFunction() instead.
       * @see {@link https://example.com/docs | External Documentation}
       */`;

      const result = parseJSDocComment(comment, 1);
      expect(result).not.toBeNull();
      expect(result!.tags).toHaveLength(3);

      const exampleTag = result!.tags.find(tag => tag.name === 'example');
      expect(exampleTag).toBeDefined();
      expect(exampleTag!.value).toContain('```typescript');
      expect(exampleTag!.value).toContain('console.log(result?.data);');
    });

    it('handles JSDoc with Unicode characters', () => {
      const comment = `/**
       * 处理用户数据 (Process user data in Chinese)
       * @param données Les données d'entrée (French)
       * @returns データ処理結果 (Japanese result)
       */`;

      const result = parseJSDocComment(comment, 1);
      expect(result).not.toBeNull();
      expect(result!.summary).toBe('处理用户数据 (Process user data in Chinese)');
      expect(result!.tags[0].value).toBe("Les données d'entrée (French)");
      expect(result!.tags[1].value).toBe('データ処理結果 (Japanese result)');
    });
  });

  describe('findExportsInSource - Complex Export Patterns', () => {
    it('finds exports in complex file with mixed patterns', () => {
      const source = `
        import { helper } from './utils';
        import type { Config } from './types';

        // Some internal utilities
        const internal = () => {};

        /** Documentation */
        export interface APIResponse<T = any> {
          data: T;
          status: number;
        }

        export type Status = 'pending' | 'complete';

        export enum Priority {
          LOW = 0,
          MEDIUM = 1,
          HIGH = 2,
        }

        export namespace Utils {
          export function helper() {}
        }

        export async function* asyncGenerator(): AsyncGenerator<number> {
          yield 1;
        }

        export const arrowFunction = (param: string) => param;
        export let mutableValue = 'initial';
        export var legacyVar = true;

        export { helper as utilityHelper };
        export { default as DefaultImport } from './other-module';
        export * as NamespaceImport from './namespace-module';

        class InternalClass {}
        export { InternalClass };

        export default class DefaultClass {
          constructor(private config: Config) {}
        }
      `;

      const exports = findExportsInSource(source);

      // Should find all export patterns
      expect(exports.length).toBeGreaterThan(10);

      // Verify specific complex patterns
      const interfaceExport = exports.find(e => e.name === 'APIResponse');
      expect(interfaceExport).toBeDefined();
      expect(interfaceExport!.kind).toBe('interface');

      const namespaceExport = exports.find(e => e.name === 'Utils');
      expect(namespaceExport).toBeDefined();
      expect(namespaceExport!.kind).toBe('namespace');

      const defaultClass = exports.find(e => e.name === 'DefaultClass' && e.isDefault);
      expect(defaultClass).toBeDefined();
      expect(defaultClass!.isDefault).toBe(true);
    });

    it('handles exports with generic type parameters', () => {
      const source = `
        export interface Generic<T, U extends Record<string, any>> {
          data: T;
          meta: U;
        }

        export class Container<T> {
          private items: T[] = [];
        }

        export function processGeneric<T extends string | number>(input: T): T[] {
          return [input];
        }
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(3);

      exports.forEach(exp => {
        expect(['Generic', 'Container', 'processGeneric']).toContain(exp.name);
      });
    });

    it('correctly identifies exports in files with complex string literals', () => {
      const source = `
        const template = \`
          export function notAnExport() {}
          // This is just a string template
        \`;

        const config = {
          code: "export const notAnExport = true;",
          description: "Contains export keyword but not real export"
        };

        /*
         * export function commentedOut() {}
         */

        // export const alsoCommented = true;

        export const REAL_EXPORT = template;
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('REAL_EXPORT');
    });

    it('handles multiline export statements', () => {
      const source = `
        export function longFunctionName(
          veryLongParameterName: string,
          anotherLongParameterName: number,
          yetAnotherLongParameter: boolean
        ): Promise<{
          result: string;
          status: number;
        }> {
          return Promise.resolve({ result: '', status: 200 });
        }

        export class ComplexClass
          extends BaseClass
          implements Interface1, Interface2 {
        }
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(2);
      expect(exports[0].name).toBe('longFunctionName');
      expect(exports[1].name).toBe('ComplexClass');
    });

    it('handles re-exports with aliases and mixed patterns', () => {
      const source = `
        export { originalName as aliasedName } from './module1';
        export {
          first,
          second as renamed,
          third
        } from './module2';
        export * from './all-exports';
        export * as NamespacedExports from './namespace';
        export type { TypeOnly } from './types';
        export type * as AllTypes from './all-types';
      `;

      const exports = findExportsInSource(source);

      // Should find individual named re-exports and namespace re-exports
      const aliasedExport = exports.find(e => e.name === 'aliasedName');
      expect(aliasedExport).toBeDefined();
      expect(aliasedExport!.isReExport).toBe(true);

      const starExport = exports.find(e => e.name === '*');
      expect(starExport).toBeDefined();
      expect(starExport!.isReExport).toBe(true);
    });
  });

  describe('detectUndocumentedExports - Advanced Validation', () => {
    it('validates comprehensive function documentation requirements', () => {
      const source = `
        /**
         * Processes complex data with multiple validation rules
         * @param data - The input data to process
         * @param options - Configuration options
         * @param callback - Optional callback function
         * @returns Promise resolving to processed data
         * @throws {ValidationError} When input data is invalid
         * @throws {ProcessingError} When processing fails
         * @example
         * const result = await processComplexData(
         *   { id: 1, name: 'test' },
         *   { validate: true },
         *   (progress) => console.log(progress)
         * );
         * @since 2.0.0
         * @deprecated Use processDataV3 instead
         */
        export async function processComplexData(
          data: Record<string, any>,
          options: ProcessingOptions,
          callback?: ProgressCallback
        ): Promise<ProcessedData> {
          return {} as ProcessedData;
        }
      `;

      const config: DetectionConfig = {
        requiredTags: ['param', 'returns', 'example'],
        minSummaryLength: 30,
      };

      const documentation = detectUndocumentedExports(source, config);
      expect(documentation).toHaveLength(1);

      const doc = documentation[0];
      expect(doc.isDocumented).toBe(true);
      expect(doc.suggestions).toHaveLength(0);
      expect(doc.jsdoc!.tags.length).toBeGreaterThan(6);
    });

    it('detects missing documentation for async generators and complex patterns', () => {
      const source = `
        export async function* dataStream(): AsyncGenerator<DataChunk> {
          yield { id: 1, data: 'test' };
        }

        export const complexArrow = async <T extends Record<string, any>>(
          input: T,
          transform: (item: T) => T
        ): Promise<T[]> => {
          return [transform(input)];
        };

        export class GenericProcessor<TInput, TOutput> {
          private queue: TInput[] = [];

          async process(input: TInput): Promise<TOutput> {
            throw new Error('Not implemented');
          }
        }
      `;

      const documentation = detectUndocumentedExports(source);
      expect(documentation).toHaveLength(3);

      // All should be undocumented
      documentation.forEach(doc => {
        expect(doc.isDocumented).toBe(false);
        expect(doc.suggestions).toContain(
          expect.stringContaining('Add JSDoc comment above')
        );
      });
    });

    it('handles configuration edge cases and boundary values', () => {
      const source = `
        /** Short */
        export function shortDocs() {}

        /**
         * This description is exactly twenty characters long
         */
        export function exactLength() {}

        /** */
        export function emptyDocs() {}
      `;

      // Test boundary conditions
      const configs = [
        { minSummaryLength: 0 },
        { minSummaryLength: 5 },  // "Short" = 5 chars
        { minSummaryLength: 20 }, // exact match
        { minSummaryLength: 21 }, // just over
        { minSummaryLength: 1000 }, // extremely high
      ];

      configs.forEach((config, index) => {
        const documentation = detectUndocumentedExports(source, config);
        expect(documentation).toHaveLength(3);

        // Verify documentation status based on summary length requirements
        const shortDoc = documentation.find(d => d.export.name === 'shortDocs')!;
        const exactDoc = documentation.find(d => d.export.name === 'exactLength')!;
        const emptyDoc = documentation.find(d => d.export.name === 'emptyDocs')!;

        expect(emptyDoc.isDocumented).toBe(false); // Empty should always fail

        if (config.minSummaryLength <= 5) {
          expect(shortDoc.isDocumented).toBe(true);
        } else {
          expect(shortDoc.isDocumented).toBe(false);
        }
      });
    });

    it('validates complex required tags combinations', () => {
      const source = `
        /**
         * Function with some tags
         * @param input The input
         * @returns The output
         * @since 1.0.0
         */
        export function partialTags(input: string): string {
          return input;
        }
      `;

      const configs = [
        { requiredTags: [] },
        { requiredTags: ['param'] },
        { requiredTags: ['param', 'returns'] },
        { requiredTags: ['param', 'returns', 'since'] },
        { requiredTags: ['param', 'returns', 'since', 'deprecated'] },
        { requiredTags: ['nonexistent'] },
      ];

      configs.forEach(config => {
        const documentation = detectUndocumentedExports(source, config);
        const doc = documentation[0];

        const hasAllRequired = config.requiredTags.every(tag =>
          doc.jsdoc!.tags.some(jsDocTag => jsDocTag.name === tag)
        );

        expect(doc.isDocumented).toBe(hasAllRequired);
      });
    });

    it('handles private and re-export filtering with complex patterns', () => {
      const source = `
        export function publicFunction() {}
        export function _privateFunction() {}
        export function __doublePrivate() {}
        export const _PRIVATE_CONSTANT = true;
        export const PUBLIC_CONSTANT = true;

        export { helper } from './utils';
        export { _privateHelper } from './utils';
        export * from './all-exports';
        export * as PublicNamespace from './namespace';
        export * as _privateNamespace from './private-namespace';
      `;

      // Test different combinations of filters
      const testCases = [
        { includePrivate: false, includeReExports: false },
        { includePrivate: true, includeReExports: false },
        { includePrivate: false, includeReExports: true },
        { includePrivate: true, includeReExports: true },
      ];

      testCases.forEach(config => {
        const documentation = detectUndocumentedExports(source, config);

        const hasPrivate = documentation.some(d => d.export.name.startsWith('_'));
        const hasReExports = documentation.some(d => d.export.isReExport);

        expect(hasPrivate).toBe(config.includePrivate);
        expect(hasReExports).toBe(config.includeReExports);
      });
    });
  });

  describe('analyzeFile - Error Handling and Edge Cases', () => {
    it('handles files with syntax errors gracefully', () => {
      const malformedSource = `
        export function validFunction() {}

        // Intentionally malformed syntax
        export class {

        export function missingName()

        export const VALID_CONST = true;
      `;

      const result = analyzeFile('malformed.ts', malformedSource);

      // Should still find the valid exports it can parse
      expect(result.exports.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0); // Our parser is resilient

      // Should find the valid function and constant
      const validExports = result.exports.filter(e =>
        e.name === 'validFunction' || e.name === 'VALID_CONST'
      );
      expect(validExports).toHaveLength(2);
    });

    it('handles extremely large files performance test', () => {
      // Generate a large file with many exports
      const largeSourceParts = [];
      const numExports = 1000;

      for (let i = 0; i < numExports; i++) {
        largeSourceParts.push(`
          /**
           * Auto-generated function ${i}
           * @param input Input parameter
           * @returns Output value
           */
          export function generatedFunction${i}(input: string): string {
            return input + '${i}';
          }
        `);
      }

      const largeSource = largeSourceParts.join('\n');

      const startTime = performance.now();
      const result = analyzeFile('large.ts', largeSource);
      const endTime = performance.now();

      // Should complete in reasonable time (less than 1 second for 1000 exports)
      expect(endTime - startTime).toBeLessThan(1000);

      expect(result.exports).toHaveLength(numExports);
      expect(result.stats.totalExports).toBe(numExports);
      expect(result.stats.documentedExports).toBe(numExports);
      expect(result.stats.coveragePercent).toBe(100);
    });

    it('calculates coverage statistics correctly for edge cases', () => {
      const testCases = [
        {
          name: 'empty file',
          source: '// Just comments',
          expectedCoverage: 100,
          expectedTotal: 0,
        },
        {
          name: 'all documented',
          source: `
            /** Doc 1 */ export function func1() {}
            /** Doc 2 */ export function func2() {}
          `,
          expectedCoverage: 100,
          expectedTotal: 2,
        },
        {
          name: 'none documented',
          source: `
            export function func1() {}
            export function func2() {}
            export function func3() {}
          `,
          expectedCoverage: 0,
          expectedTotal: 3,
        },
        {
          name: 'partial documentation',
          source: `
            /** Documented */ export function func1() {}
            export function func2() {}
            /** Documented */ export function func3() {}
            export function func4() {}
          `,
          expectedCoverage: 50,
          expectedTotal: 4,
        },
      ];

      testCases.forEach(testCase => {
        const result = analyzeFile(testCase.name, testCase.source);

        expect(result.stats.totalExports).toBe(testCase.expectedTotal);
        expect(result.stats.coveragePercent).toBe(testCase.expectedCoverage);
        expect(result.stats.documentedExports + result.stats.undocumentedExports)
          .toBe(result.stats.totalExports);
      });
    });
  });

  describe('analyzeFiles - Batch Processing Edge Cases', () => {
    it('handles mixed file types and extensions correctly', () => {
      const files = [
        { path: 'valid.ts', content: 'export function test() {}' },
        { path: 'valid.tsx', content: 'export const Component = () => null;' },
        { path: 'valid.js', content: 'export const value = true;' },
        { path: 'valid.jsx', content: 'export default function App() {}' },
        { path: 'invalid.txt', content: 'export function shouldBeIgnored() {}' },
        { path: 'invalid.py', content: 'def python_function(): pass' },
        { path: 'no-extension', content: 'export const test = true;' },
        { path: 'valid.d.ts', content: 'export declare function typed(): void;' },
      ];

      const defaultResult = analyzeFiles(files);
      expect(defaultResult).toHaveLength(5); // .ts, .tsx, .js, .jsx, .d.ts

      const customResult = analyzeFiles(files, { extensions: ['.ts', '.py'] });
      expect(customResult).toHaveLength(1); // Only .ts file

      const emptyResult = analyzeFiles(files, { extensions: ['.nonexistent'] });
      expect(emptyResult).toHaveLength(0);
    });

    it('handles large batch processing with diverse configurations', () => {
      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.ts`,
        content: `
          /** Documentation for file ${i} */
          export function func${i}(param: string): void {}

          export function undocumented${i}() {}
        `,
      }));

      const configs = [
        {},
        { minSummaryLength: 50 },
        { requiredTags: ['param'] },
        { includePrivate: true, includeReExports: true },
      ];

      configs.forEach(config => {
        const results = analyzeFiles(files, config);
        expect(results).toHaveLength(100);

        results.forEach(result => {
          expect(result.exports).toHaveLength(2);
          expect(result.stats.totalExports).toBe(2);
        });
      });
    });

    it('preserves file order and handles empty content', () => {
      const files = [
        { path: 'first.ts', content: 'export const first = 1;' },
        { path: 'empty.ts', content: '' },
        { path: 'comments-only.ts', content: '// Just comments\n/* More comments */' },
        { path: 'last.ts', content: 'export const last = 2;' },
      ];

      const results = analyzeFiles(files);
      expect(results).toHaveLength(4);

      // Should maintain order
      expect(results[0].filePath).toBe('first.ts');
      expect(results[1].filePath).toBe('empty.ts');
      expect(results[2].filePath).toBe('comments-only.ts');
      expect(results[3].filePath).toBe('last.ts');

      // Empty files should have zero stats
      expect(results[1].stats.totalExports).toBe(0);
      expect(results[2].stats.totalExports).toBe(0);
    });
  });
});