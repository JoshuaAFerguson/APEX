import { describe, it, expect, vi } from 'vitest';
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

describe.skip('JSDoc Detector', () => {
  describe('parseJSDocComment', () => {
    it('parses simple JSDoc comment', () => {
      const comment = '/** This is a simple description */';
      const result = parseJSDocComment(comment, 1);

      expect(result).toEqual({
        raw: comment,
        summary: 'This is a simple description',
        startLine: 1,
        endLine: 2,
        tags: [],
        hasContent: true,
      });
    });

    it('parses multi-line JSDoc with tags', () => {
      const comment = `/**
       * Processes user data
       * @param name The user's name
       * @param age The user's age
       * @returns Processed user object
       */`;
      const result = parseJSDocComment(comment, 10);

      expect(result).not.toBeNull();
      expect(result!.summary).toBe('Processes user data');
      expect(result!.tags).toHaveLength(3);
      expect(result!.tags[0]).toEqual({
        name: 'param',
        value: "The user's name",
        paramName: 'name',
        type: undefined,
      });
      expect(result!.tags[1]).toEqual({
        name: 'param',
        value: "The user's age",
        paramName: 'age',
        type: undefined,
      });
      expect(result!.tags[2]).toEqual({
        name: 'returns',
        value: 'Processed user object',
        paramName: undefined,
        type: undefined,
      });
    });

    it('parses JSDoc with typed parameters', () => {
      const comment = `/**
       * @param {string} name - The name
       * @param {number} age - The age
       * @returns {object} The result
       */`;
      const result = parseJSDocComment(comment, 1);

      expect(result!.tags).toHaveLength(3);
      expect(result!.tags[0]).toEqual({
        name: 'param',
        value: '- The name',
        paramName: 'name',
        type: 'string',
      });
      expect(result!.tags[2]).toEqual({
        name: 'returns',
        value: 'The result',
        paramName: undefined,
        type: 'object',
      });
    });

    it('handles empty JSDoc comment', () => {
      const comment = '/** */';
      const result = parseJSDocComment(comment, 1);

      expect(result).toEqual({
        raw: comment,
        summary: '',
        startLine: 1,
        endLine: 2,
        tags: [],
        hasContent: false,
      });
    });

    it('returns null for invalid input', () => {
      expect(parseJSDocComment('', 1)).toBeNull();
      expect(parseJSDocComment('// Not a JSDoc', 1)).toBeNull();
      expect(parseJSDocComment('/* Regular comment */', 1)).toBeNull();
    });

    it('handles JSDoc with only tags (no summary)', () => {
      const comment = `/**
       * @deprecated Use newFunction instead
       * @since 1.0.0
       */`;
      const result = parseJSDocComment(comment, 1);

      expect(result!.summary).toBe('');
      expect(result!.tags).toHaveLength(2);
      expect(result!.hasContent).toBe(true);
    });
  });

  describe('findExportsInSource', () => {
    it('finds named function exports', () => {
      const source = `
        export function processData(input: string): string {
          return input.toLowerCase();
        }

        export async function fetchData(): Promise<Data> {
          return {};
        }
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(2);

      expect(exports[0]).toEqual({
        name: 'processData',
        kind: 'function',
        line: 2,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: 'export function processData(input: string): string {',
      });

      expect(exports[1]).toEqual({
        name: 'fetchData',
        kind: 'function',
        line: 6,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: 'export async function fetchData(): Promise<Data> {',
      });
    });

    it('finds class exports', () => {
      const source = `
        export class UserProcessor {
          process() {}
        }
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(1);
      expect(exports[0]).toEqual({
        name: 'UserProcessor',
        kind: 'class',
        line: 2,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: 'export class UserProcessor {',
      });
    });

    it('finds interface and type exports', () => {
      const source = `
        export interface UserConfig {
          name: string;
        }

        export type Status = 'active' | 'inactive';
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(2);

      expect(exports[0]).toEqual({
        name: 'UserConfig',
        kind: 'interface',
        line: 2,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: 'export interface UserConfig {',
      });

      expect(exports[1]).toEqual({
        name: 'Status',
        kind: 'type',
        line: 6,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: "export type Status = 'active' | 'inactive';",
      });
    });

    it('finds variable exports', () => {
      const source = `
        export const DEFAULT_CONFIG = {};
        export let currentState = 'idle';
        export var globalFlag = true;
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(3);

      expect(exports[0]).toEqual({
        name: 'DEFAULT_CONFIG',
        kind: 'const',
        line: 2,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: 'export const DEFAULT_CONFIG = {};',
      });

      expect(exports[1].kind).toBe('let');
      expect(exports[2].kind).toBe('var');
    });

    it('finds default exports', () => {
      const source = `
        export default function processData() {}

        export default class UserProcessor {}

        export default myVariable;
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(3);

      expect(exports[0]).toEqual({
        name: 'processData',
        kind: 'function',
        line: 2,
        column: 9,
        isDefault: true,
        isReExport: false,
        rawStatement: 'export default function processData() {}',
      });

      expect(exports[1]).toEqual({
        name: 'UserProcessor',
        kind: 'class',
        line: 4,
        column: 9,
        isDefault: true,
        isReExport: false,
        rawStatement: 'export default class UserProcessor {}',
      });

      expect(exports[2]).toEqual({
        name: 'myVariable',
        kind: 'default',
        line: 6,
        column: 9,
        isDefault: true,
        isReExport: false,
        rawStatement: 'export default myVariable;',
      });
    });

    it('finds re-exports', () => {
      const source = `
        export { helper } from './helpers';
        export { foo, bar as baz } from './utils';
        export * from './constants';
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(4);

      expect(exports[0]).toEqual({
        name: 'helper',
        kind: 're-export',
        line: 2,
        column: 9,
        isDefault: false,
        isReExport: true,
        sourceModule: './helpers',
        rawStatement: "export { helper } from './helpers';",
      });

      expect(exports[1].name).toBe('foo');
      expect(exports[2].name).toBe('baz'); // Handles "bar as baz"
      expect(exports[3].name).toBe('*');
    });

    it('finds export lists', () => {
      const source = `
        const helper = () => {};
        const processor = {};
        export { helper, processor as mainProcessor };
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(2);

      expect(exports[0]).toEqual({
        name: 'helper',
        kind: 'unknown',
        line: 4,
        column: 9,
        isDefault: false,
        isReExport: false,
        rawStatement: 'export { helper, processor as mainProcessor };',
      });

      expect(exports[1].name).toBe('mainProcessor'); // Handles "processor as mainProcessor"
    });

    it('ignores comments and non-export lines', () => {
      const source = `
        // This is a comment
        /* Block comment */
        const internal = {};
        function helper() {}

        export function onlyExport() {}
      `;

      const exports = findExportsInSource(source);
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('onlyExport');
    });
  });

  describe('detectUndocumentedExports', () => {
    it('identifies documented exports', () => {
      const source = `
        /**
         * Processes user input data
         * @param input The input data
         * @returns Processed data
         */
        export function processData(input: string): string {
          return input;
        }
      `;

      const documentation = detectUndocumentedExports(source);
      expect(documentation).toHaveLength(1);

      const doc = documentation[0];
      expect(doc.export.name).toBe('processData');
      expect(doc.jsdoc).not.toBeNull();
      expect(doc.isDocumented).toBe(true);
      expect(doc.suggestions).toHaveLength(0);
    });

    it('identifies undocumented exports', () => {
      const source = `
        export function processData(input: string): string {
          return input;
        }
      `;

      const documentation = detectUndocumentedExports(source);
      expect(documentation).toHaveLength(1);

      const doc = documentation[0];
      expect(doc.export.name).toBe('processData');
      expect(doc.jsdoc).toBeNull();
      expect(doc.isDocumented).toBe(false);
      expect(doc.suggestions).toContain('Add JSDoc comment above the function declaration');
    });

    it('detects inadequate documentation', () => {
      const source = `
        /** Short */
        export function processData(input: string): string {
          return input;
        }
      `;

      const config: DetectionConfig = { minSummaryLength: 10 };
      const documentation = detectUndocumentedExports(source, config);

      const doc = documentation[0];
      expect(doc.isDocumented).toBe(false);
      expect(doc.suggestions).toContain('Expand the description (current: 5 chars, minimum: 10)');
    });

    it('checks for missing parameter documentation', () => {
      const source = `
        /**
         * Processes data
         */
        export function processData(input: string, options: object): string {
          return input;
        }
      `;

      const documentation = detectUndocumentedExports(source);
      const doc = documentation[0];

      expect(doc.isDocumented).toBe(false);
      expect(doc.suggestions).toContain('Document function parameters with @param tags');
    });

    it('checks for missing return documentation', () => {
      const source = `
        /**
         * Processes data
         * @param input The input data
         */
        export function processData(input: string): string {
          return input;
        }
      `;

      const documentation = detectUndocumentedExports(source);
      const doc = documentation[0];

      expect(doc.suggestions).toContain('Document return value with @returns tag');
    });

    it('validates required tags', () => {
      const source = `
        /**
         * This function is deprecated
         * @param input The input
         */
        export function oldFunction(input: string): string {
          return input;
        }
      `;

      const config: DetectionConfig = { requiredTags: ['deprecated'] };
      const documentation = detectUndocumentedExports(source, config);

      const doc = documentation[0];
      expect(doc.isDocumented).toBe(false);
      expect(doc.suggestions).toContain('Add @deprecated tag');
    });

    it('filters private exports when configured', () => {
      const source = `
        export function publicFunction() {}
        export function _privateFunction() {}
      `;

      const config: DetectionConfig = { includePrivate: false };
      const documentation = detectUndocumentedExports(source, config);

      expect(documentation).toHaveLength(1);
      expect(documentation[0].export.name).toBe('publicFunction');
    });

    it('filters re-exports when configured', () => {
      const source = `
        export function localFunction() {}
        export { helper } from './utils';
      `;

      const config: DetectionConfig = { includeReExports: false };
      const documentation = detectUndocumentedExports(source, config);

      expect(documentation).toHaveLength(1);
      expect(documentation[0].export.name).toBe('localFunction');
    });

    it('matches JSDoc comments to correct exports', () => {
      const source = `
        /**
         * First function docs
         */
        export function firstFunction() {}

        /**
         * Second function docs
         */
        export function secondFunction() {}

        export function undocumentedFunction() {}
      `;

      const documentation = detectUndocumentedExports(source);
      expect(documentation).toHaveLength(3);

      expect(documentation[0].export.name).toBe('firstFunction');
      expect(documentation[0].jsdoc?.summary).toBe('First function docs');
      expect(documentation[0].isDocumented).toBe(true);

      expect(documentation[1].export.name).toBe('secondFunction');
      expect(documentation[1].jsdoc?.summary).toBe('Second function docs');
      expect(documentation[1].isDocumented).toBe(true);

      expect(documentation[2].export.name).toBe('undocumentedFunction');
      expect(documentation[2].jsdoc).toBeNull();
      expect(documentation[2].isDocumented).toBe(false);
    });
  });

  describe('analyzeFile', () => {
    it('analyzes a complete file', () => {
      const source = `
        /**
         * Well documented function
         * @param input The input data
         * @returns Processed output
         */
        export function documentedFunction(input: string): string {
          return input;
        }

        export function undocumentedFunction() {}

        /**
         * Partial docs
         */
        export function partiallyDocumented(param: string): string {
          return param;
        }
      `;

      const result = analyzeFile('test.ts', source);

      expect(result.filePath).toBe('test.ts');
      expect(result.exports).toHaveLength(3);
      expect(result.documentation).toHaveLength(3);
      expect(result.stats.totalExports).toBe(3);
      expect(result.stats.documentedExports).toBe(1);
      expect(result.stats.undocumentedExports).toBe(2);
      expect(result.stats.coveragePercent).toBe(33.33);
      expect(result.errors).toHaveLength(0);
    });

    it('handles parse errors gracefully', () => {
      const source = `
        export function normalFunction() {}
      `;

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = analyzeFile('test.ts', source);

      expect(result.stats.totalExports).toBe(1);
      expect(result.errors).toHaveLength(0); // Our implementation doesn't throw

      consoleSpy.mockRestore();
    });

    it('calculates coverage correctly for empty files', () => {
      const source = `// Just a comment`;

      const result = analyzeFile('empty.ts', source);

      expect(result.stats.totalExports).toBe(0);
      expect(result.stats.coveragePercent).toBe(100); // No exports = 100% coverage
    });
  });

  describe('analyzeFiles', () => {
    it('analyzes multiple files with filtering by extension', () => {
      const files = [
        { path: 'src/utils.ts', content: 'export function helper() {}' },
        { path: 'src/component.tsx', content: 'export class Component {}' },
        { path: 'README.md', content: '# Documentation' },
        { path: 'src/types.js', content: 'export const TYPE = "test";' },
      ];

      const results = analyzeFiles(files);

      expect(results).toHaveLength(3); // Excludes .md file
      expect(results[0].filePath).toBe('src/utils.ts');
      expect(results[1].filePath).toBe('src/component.tsx');
      expect(results[2].filePath).toBe('src/types.js');
    });

    it('respects custom extension configuration', () => {
      const files = [
        { path: 'src/utils.ts', content: 'export function helper() {}' },
        { path: 'src/script.py', content: 'def helper(): pass' },
      ];

      const config: DetectionConfig = { extensions: ['.ts'] };
      const results = analyzeFiles(files, config);

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('src/utils.ts');
    });

    it('handles empty file list', () => {
      const results = analyzeFiles([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('integration tests', () => {
    it('handles complex real-world TypeScript file', () => {
      const source = `
        import { SomeType } from './types';

        /**
         * Configuration for the data processor
         */
        export interface ProcessorConfig {
          timeout: number;
          retries: number;
        }

        /**
         * Status enumeration for processing states
         */
        export enum ProcessingStatus {
          Pending = 'pending',
          Processing = 'processing',
          Complete = 'complete',
          Failed = 'failed',
        }

        /**
         * Processes data with the given configuration
         * @param data - The input data to process
         * @param config - Processing configuration options
         * @returns Promise that resolves to processed data
         * @throws Error when processing fails
         */
        export async function processData(
          data: unknown[],
          config: ProcessorConfig
        ): Promise<unknown[]> {
          return data;
        }

        /**
         * Default configuration object
         */
        export const DEFAULT_CONFIG: ProcessorConfig = {
          timeout: 5000,
          retries: 3,
        };

        // Internal helper - not exported
        function internalHelper() {}

        export class DataProcessor {
          process() {}
        }

        export default DataProcessor;
      `;

      const result = analyzeFile('processor.ts', source);

      expect(result.exports).toHaveLength(6);
      expect(result.stats.totalExports).toBe(6);
      expect(result.stats.documentedExports).toBe(4);
      expect(result.stats.undocumentedExports).toBe(2);

      // Check specific undocumented items
      const undocumented = result.documentation.filter(d => !d.isDocumented);
      expect(undocumented).toHaveLength(2);
      expect(undocumented.some(d => d.export.name === 'DataProcessor')).toBe(true);
      expect(undocumented.some(d => d.export.name === 'DataProcessor' && d.export.isDefault)).toBe(true);
    });

    it('correctly identifies JSDoc quality issues', () => {
      const source = `
        /**
         * Bad function documentation
         */
        export function complexFunction(
          required: string,
          optional?: number,
          callback?: (result: string) => void
        ): Promise<string> {
          return Promise.resolve('');
        }
      `;

      const config: DetectionConfig = {
        minSummaryLength: 20,
        requiredTags: ['param', 'returns'],
      };

      const result = analyzeFile('complex.ts', source, config);
      const doc = result.documentation[0];

      expect(doc.isDocumented).toBe(false);
      expect(doc.suggestions).toContain('Expand the description (current: 25 chars, minimum: 20)');
      expect(doc.suggestions).toContain('Add @param tag');
      expect(doc.suggestions).toContain('Add @returns tag');
    });
  });
});