/**
 * ConventionAnalyzer Documentation Edge Cases Tests
 * Comprehensive tests for documentation style detection edge cases and complex scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Documentation Edge Cases', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-doc-edge-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complex Documentation Pattern Detection', () => {
    it('should handle malformed JSDoc that still contains valid patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const malformedJsdocCode = `
/**
 * Valid JSDoc with typo in tag
 * @param {string} name - The user name
 * @parma {number} age - Typo in param tag (should still count as JSDoc)
 * @returns {User} The user object
 */
function createUser(name, age) {
  return { name, age };
}

/**
 Incomplete JSDoc - missing asterisks
 @param value The value
 @returns The result
 */
function incompleteDoc(value) {
  return value * 2;
}

/**
 * JSDoc with missing closing
 * @param input - Input value
 * @returns Output value
function unclosedDoc(input) {
  return input;
}

/**
 * Valid complete JSDoc
 * @param {boolean} flag - Boolean flag
 * @returns {string} Status message
 */
function validDoc(flag) {
  return flag ? 'enabled' : 'disabled';
}

// Function without documentation
function noDoc() {}
`;

      await fs.writeFile(join(srcDir, 'malformed.js'), malformedJsdocCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(60); // 3-4 out of 5 functions documented
    });

    it('should detect TSDoc tags in complex scenarios', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexTsdocCode = `
/**
 * Advanced function with multiple TSDoc-specific tags
 * @param config - Configuration object
 * @returns Promise resolving to result
 * @throws {ValidationError} When validation fails
 * @throws {NetworkError} When network fails
 * @example Basic usage:
 * \`\`\`typescript
 * await processConfig({ timeout: 5000 });
 * \`\`\`
 * @example Advanced usage:
 * \`\`\`typescript
 * const result = await processConfig({
 *   timeout: 10000,
 *   retries: 3
 * });
 * \`\`\`
 * @since 2.1.0
 * @beta This API is in beta
 * @deprecated Use processConfigV2 instead
 * @see {@link processConfigV2} for the new implementation
 * @internal For internal use only
 * @alpha Early alpha release
 * @public Available in public API
 * @sealed Cannot be extended
 * @virtual Can be overridden
 * @override Overrides parent method
 * @readonly Property is read-only
 * @defaultValue \`{ timeout: 5000 }\`
 * @remarks This function handles complex configuration processing
 * with multiple validation layers and error handling.
 */
async function processConfig(config: ConfigOptions): Promise<ProcessResult> {
  return { processed: true };
}

/**
 * Interface with TSDoc tags
 * @public This is a public interface
 * @since 1.0.0
 */
interface ConfigOptions {
  /** @readonly Timeout value cannot be changed */
  readonly timeout: number;

  /** @beta Beta property */
  retries?: number;

  /** @deprecated Use newUrl instead */
  url?: string;

  /** @internal For internal configuration */
  internalFlag?: boolean;
}

/**
 * Class with mixed TSDoc and JSDoc tags
 * @class Main processor class
 * @since 2.0.0
 * @public
 */
class ConfigProcessor {
  /**
   * Constructor with TSDoc
   * @param options - Initial options
   * @beta Constructor is in beta
   */
  constructor(private options: ConfigOptions) {}

  /**
   * Method with traditional JSDoc
   * @param {string} key - The configuration key
   * @param {any} value - The value to set
   * @returns {void}
   */
  setConfig(key: string, value: any): void {
    // Implementation
  }
}

// Undocumented function for coverage calculation
function undocumentedHelper() {
  return 'helper';
}
`;

      await fs.writeFile(join(srcDir, 'complex-tsdoc.ts'), complexTsdocCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('tsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(80); // Most elements documented
    });

    it('should detect markdown documentation in various formats', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const markdownVariationsCode = `
/*
 * # Main Module
 *
 * This module provides **core functionality** for data processing.
 *
 * ## Features
 *
 * - High performance data processing
 * - Multiple input formats supported
 * - Extensible plugin architecture
 *
 * ### Supported Formats
 *
 * 1. **JSON**: Standard JSON format
 * 2. **XML**: XML with schema validation
 * 3. **CSV**: Comma-separated values
 *
 * #### Performance Notes
 *
 * > This module is optimized for large datasets
 *
 * ##### Example Usage
 *
 * \`\`\`javascript
 * const processor = new DataProcessor();
 * const result = await processor.process(data);
 * \`\`\`
 *
 * ###### Configuration
 *
 * Configuration can be provided via:
 * - Environment variables
 * - Config files
 * - Runtime options
 *
 * Links: [Documentation](https://example.com/docs)
 * Images: ![Logo](https://example.com/logo.png)
 *
 * Tables:
 * | Option | Type | Default |
 * |--------|------|---------|
 * | debug  | boolean | false |
 * | timeout | number | 5000 |
 *
 * Lists:
 * - Item 1
 *   - Nested item
 *   - Another nested
 * - Item 2
 *
 * Numbered:
 * 1. First step
 * 2. Second step
 *
 * Code blocks:
 * \`\`\`typescript
 * interface Options {
 *   debug: boolean;
 * }
 * \`\`\`
 *
 * Inline code: \`const value = 42;\`
 *
 * **Bold**, *italic*, and ***bold italic*** text.
 *
 * Strikethrough: ~~old text~~
 */
function processData(data, options) {
  return { processed: true };
}

/*
 * ## Secondary Function
 *
 * This function handles **data validation** with the following rules:
 *
 * - Must be object or array
 * - Cannot be null or undefined
 * - Must pass schema validation
 *
 * \`\`\`json
 * {
 *   "type": "object",
 *   "required": ["id", "name"]
 * }
 * \`\`\`
 *
 * [Validation Schema](https://example.com/schema)
 */
function validateData(data) {
  return data != null;
}

function undocumentedFunction() {
  return 'test';
}
`;

      await fs.writeFile(join(srcDir, 'markdown.js'), markdownVariationsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('markdown');
      expect(result.documentation.coverage).toBeGreaterThan(65); // 2 out of 3 functions
    });

    it('should handle inline documentation with various prefixes and styles', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const inlineVariationsCode = `
// Standard inline documentation for this function
// Provides detailed explanation of the implementation
function standardInline() {}

/// XML-style documentation comment (C# style)
/// Used in some codebases for compatibility
function xmlStyleComment() {}

//! Important comment (Rust style)
//! Indicates critical functionality
function rustStyleImportant() {}

//# Python-style comment in JS context
//# Less common but sometimes used
function pythonStyleComment() {}

// TODO: This needs better implementation
// FIXME: Current approach is inefficient
// NOTE: Remember to update related functions
// HACK: Temporary workaround for edge case
// BUG: Known issue with negative values
// WARNING: This function may throw exceptions
function annotatedComments() {}

// Single line short
function shortComment() {}

// Multi-line inline documentation
// that spans several lines and provides
// comprehensive explanation of the function's
// purpose, parameters, and return value
function multiLineInline() {}

//
// Block-style inline comments
// with empty lines for separation
//
function blockStyleInline() {}

    // Indented comment following code style
    function indentedComment() {}

// Comment with special characters: @#$%^&*()
// Unicode characters: αβγδ emoji 🚀
// Special formatting: <tag>content</tag>
function specialCharsComment() {}

function noDocumentation() {}

// Comment not directly before function

function separatedComment() {}
`;

      await fs.writeFile(join(srcDir, 'inline-variations.js'), inlineVariationsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('inline');
      expect(result.documentation.coverage).toBeGreaterThan(70); // Most functions documented
    });
  });

  describe('Coverage Calculation Edge Cases', () => {
    it('should handle arrow functions and various function declarations', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const functionVariationsCode = `
/**
 * Traditional function declaration
 */
function traditionalFunction() {}

/**
 * Arrow function assigned to const
 */
const arrowFunction = () => {};

/**
 * Arrow function with parameters
 */
const arrowWithParams = (a, b) => a + b;

/**
 * Async arrow function
 */
const asyncArrow = async () => {};

/**
 * Function expression
 */
const functionExpression = function() {};

/**
 * Named function expression
 */
const namedFunctionExpression = function namedFunc() {};

/**
 * Async function declaration
 */
async function asyncFunction() {}

/**
 * Generator function
 */
function* generatorFunction() {}

/**
 * Async generator function
 */
async function* asyncGeneratorFunction() {}

/**
 * Method in object literal
 */
const obj = {
  /**
   * Object method
   */
  method() {},

  undocumentedMethod() {},

  /**
   * Arrow function as method
   */
  arrowMethod: () => {},

  /**
   * Async method
   */
  async asyncMethod() {}
};

/**
 * Class with various method types
 */
class TestClass {
  /**
   * Constructor documentation
   */
  constructor() {}

  /**
   * Regular method
   */
  regularMethod() {}

  /**
   * Static method
   */
  static staticMethod() {}

  /**
   * Async method
   */
  async asyncMethod() {}

  /**
   * Generator method
   */
  * generatorMethod() {}

  /**
   * Async generator method
   */
  async * asyncGeneratorMethod() {}

  // Undocumented methods
  undocumentedMethod() {}
  static undocumentedStatic() {}
}

// Undocumented arrow functions
const undocumentedArrow = () => {};
const undocumentedAsync = async () => {};

// Function without name (IIFE)
(function() {
  // Should not be counted
})();

(() => {
  // Should not be counted
})();
`;

      await fs.writeFile(join(srcDir, 'function-variations.js'), functionVariationsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should detect most documentable elements
      expect(result.documentation.coverage).toBeGreaterThan(50);
      expect(result.documentation.coverage).toBeLessThan(100);
    });

    it('should correctly count TypeScript-specific constructs', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typescriptConstructsCode = `
/**
 * Standard interface
 */
interface StandardInterface {
  prop: string;
}

interface UndocumentedInterface {
  prop: number;
}

/**
 * Generic interface
 */
interface GenericInterface<T> {
  data: T;
}

/**
 * Extended interface
 */
interface ExtendedInterface extends StandardInterface {
  additionalProp: boolean;
}

/**
 * Type alias for union
 */
type UnionType = string | number | boolean;

type UndocumentedType = object;

/**
 * Generic type alias
 */
type GenericType<T, U> = {
  first: T;
  second: U;
};

/**
 * Mapped type
 */
type MappedType<T> = {
  readonly [K in keyof T]: T[K];
};

/**
 * Conditional type
 */
type ConditionalType<T> = T extends string ? string[] : T;

/**
 * Enum documentation
 */
enum DocumentedEnum {
  FIRST = 'first',
  SECOND = 'second'
}

enum UndocumentedEnum {
  VALUE1,
  VALUE2
}

/**
 * Const enum
 */
const enum ConstEnum {
  A = 1,
  B = 2
}

/**
 * Abstract class
 */
abstract class AbstractClass {
  /**
   * Abstract method
   */
  abstract abstractMethod(): void;

  /**
   * Concrete method
   */
  concreteMethod() {}

  undocumentedAbstract(): void {}
}

/**
 * Decorator function
 */
function decorator(target: any, propertyKey: string) {}

/**
 * Class with decorators
 */
@decorator
class DecoratedClass {
  /**
   * Decorated property
   */
  @decorator
  decoratedProperty: string;

  @decorator
  undocumentedProperty: number;

  /**
   * Decorated method
   */
  @decorator
  decoratedMethod() {}
}

/**
 * Namespace
 */
namespace DocumentedNamespace {
  /**
   * Nested function
   */
  export function nestedFunction() {}

  export function undocumentedNested() {}
}

/**
 * Module declaration
 */
declare module 'external-module' {
  /**
   * Module function
   */
  export function moduleFunction(): void;

  export function undocumentedModuleFunction(): void;
}

// Undocumented constructs
type UndocumentedMapped<T> = { [K in keyof T]: string };
interface UndocumentedGeneric<T> extends StandardInterface { data: T }
`;

      await fs.writeFile(join(srcDir, 'typescript-constructs.ts'), typescriptConstructsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // TypeScript constructs should be counted in coverage
      expect(result.documentation.coverage).toBeGreaterThan(40);
      expect(result.documentation.coverage).toBeLessThan(80);
    });

    it('should handle files with mixed content and complex spacing', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedContentCode = `
/* File header comment - should not count toward function documentation */

import { someUtil } from './utils';
import type { Config } from './types';

// Global constants
const API_URL = 'https://api.example.com';
const TIMEOUT = 5000;

/**
 * Function with documentation immediately following
 */
function immediateDoc() {}


/**
 * Function with spacing before
 */


function spacedDoc() {}

// Some comment about the code structure

/**
 * Function after unrelated comment
 */
function afterUnrelated() {}

// This comment is for the variable below
const someVariable = 42;

// This comment is not for any function
// It's just a general comment

function noDocForThis() {}

/**
 * Properly documented function
 */
function properDoc() {}

/*
 * Block comment for this function
 */
function blockCommentDoc() {}

// Inline comment for this one
function inlineDoc() {}

/**
 * JSDoc followed by blank lines
 */



function blanksAfterDoc() {}

function undoc1() {}

function undoc2() {}

/**
 * Last documented function
 */
function lastDoc() {}

// Trailing comments that don't document anything
// More trailing comments

export { immediateDoc, properDoc };
`;

      await fs.writeFile(join(srcDir, 'mixed-content.js'), mixedContentCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(40);
      expect(result.documentation.coverage).toBeLessThan(80);
    });
  });

  describe('File Type Handling', () => {
    it('should only analyze appropriate file types for documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // JavaScript file - should be analyzed
      const jsCode = `
/**
 * JS function
 */
function jsFunction() {}
`;

      // TypeScript file - should be analyzed
      const tsCode = `
/**
 * TS function
 */
function tsFunction() {}
`;

      // Vue file - should be analyzed
      const vueCode = `
<template>
  <div>Component</div>
</template>
<script>
/**
 * Vue component method
 */
export default {
  methods: {
    vueMethod() {}
  }
}
</script>
`;

      // JSON file - should not be analyzed for documentation
      const jsonCode = `{"name": "test", "version": "1.0.0"}`;

      // CSS file - should not be analyzed for documentation
      const cssCode = `.class { color: red; }`;

      // Python file - should not be analyzed (different language)
      const pyCode = `
def python_function():
    """Python docstring"""
    pass
`;

      await fs.writeFile(join(srcDir, 'test.js'), jsCode);
      await fs.writeFile(join(srcDir, 'test.ts'), tsCode);
      await fs.writeFile(join(srcDir, 'Component.vue'), vueCode);
      await fs.writeFile(join(srcDir, 'package.json'), jsonCode);
      await fs.writeFile(join(srcDir, 'styles.css'), cssCode);
      await fs.writeFile(join(srcDir, 'script.py'), pyCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should only count JS/TS/Vue files
      expect(result.documentation.coverage).toBe(100); // All JS/TS functions documented
    });

    it('should handle empty and nearly empty files gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Completely empty file
      await fs.writeFile(join(srcDir, 'empty.js'), '');

      // File with only comments
      const onlyCommentsCode = `
// Just comments
/* Block comment */
/**
 * JSDoc comment not attached to anything
 */
// More comments
`;

      // File with only imports and constants
      const importsOnlyCode = `
import { utils } from './utils';
const API_KEY = 'abc123';
export { API_KEY };
`;

      // File with one function
      const oneFunction = `
/**
 * Single function
 */
function singleFunc() {}
`;

      await fs.writeFile(join(srcDir, 'only-comments.js'), onlyCommentsCode);
      await fs.writeFile(join(srcDir, 'imports-only.js'), importsOnlyCode);
      await fs.writeFile(join(srcDir, 'one-function.js'), oneFunction);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBe(100); // Only the documented function counts
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle files with syntax errors gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // File with syntax errors but valid documentation patterns
      const syntaxErrorCode = `
/**
 * Function with syntax errors
 */
function badSyntax( {
  // Missing closing parenthesis and brace
  return incomplete

/**
 * Another function with issues
 */
function unclosedFunction() {
  if (true {
    // Missing closing parenthesis and brace

/**
 * Valid function despite file issues
 */
function validFunction() {
  return 'valid';
}

// Unclosed comment
/* This comment never closes
function afterUnclosedComment() {}
`;

      // Valid file for comparison
      const validCode = `
/**
 * Valid function
 */
function validFunction() {
  return true;
}

function undocumentedValid() {
  return false;
}
`;

      await fs.writeFile(join(srcDir, 'syntax-errors.js'), syntaxErrorCode);
      await fs.writeFile(join(srcDir, 'valid.js'), validCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(40); // Should still detect some patterns
    });

    it('should handle very large documentation blocks', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Generate very large JSDoc
      let largeJsdoc = '/**\n * Very large JSDoc comment\n';
      for (let i = 0; i < 1000; i++) {
        largeJsdoc += ` * Line ${i} of documentation with details about parameter ${i % 10}\n`;
      }
      largeJsdoc += ' * @param data - Input data\n';
      largeJsdoc += ' * @returns Result\n';
      largeJsdoc += ' */';

      const largeDocCode = `
${largeJsdoc}
function functionWithLargeDoc(data) {
  return data;
}

function undocumentedFunction() {
  return 'test';
}
`;

      await fs.writeFile(join(srcDir, 'large-doc.js'), largeDocCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBe(50); // 1 out of 2 functions
    });

    it('should handle files with unusual encoding or special characters', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const specialCharsCode = `
/**
 * Function with Unicode characters: αβγδεζ
 * Special symbols: ♠♣♥♦
 * Emoji: 🚀🎉✨🔥
 * Math: ∑∏∫∆∇
 * @param データ - Japanese parameter name
 * @returns 結果 - Japanese return description
 */
function unicodeFunction(データ) {
  return '結果';
}

/**
 * Function with various quotes: "double" 'single' \`backtick\`
 * Escape sequences: \\n \\t \\r \\"
 * HTML entities: &lt; &gt; &amp; &quot;
 */
function quotesFunction() {
  return "mixed'quotes\`here";
}

// Inline with special chars: αβγ 🚀 testing
function specialInline() {}

/*
 * # Markdown with Unicode
 *
 * This function uses **unicode** characters and *emoji* 🎯
 *
 * \`\`\`javascript
 * const result = markdownUnicode('test');
 * \`\`\`
 */
function markdownUnicode(input) {
  return input + '✅';
}

function undocumentedSpecial() {
  return 'テスト';
}
`;

      await fs.writeFile(join(srcDir, 'special-chars.js'), specialCharsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBe(75); // 3 out of 4 functions documented
    });
  });
});