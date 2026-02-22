/**
 * ConventionAnalyzer Coverage Calculation Tests
 * Focused tests for ensuring accurate documentation coverage percentage calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Coverage Calculation', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-coverage-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Precise Coverage Calculation', () => {
    it('should calculate exactly 0% coverage for completely undocumented code', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const undocumentedCode = `
function func1() { return 1; }
function func2() { return 2; }
function func3() { return 3; }
function func4() { return 4; }
function func5() { return 5; }

class Class1 {
  method1() {}
  method2() {}
}

class Class2 {
  method3() {}
}

interface Interface1 {
  prop: string;
}

interface Interface2 {
  prop: number;
}

type Type1 = string;
type Type2 = number;

export function exportedFunc() {}
export class ExportedClass {}
export interface ExportedInterface { prop: boolean }
export type ExportedType = object;
`;

      await fs.writeFile(join(srcDir, 'undocumented.ts'), undocumentedCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(0);
      expect(result.documentation.style).toBe('none');
    });

    it('should calculate exactly 100% coverage for fully documented code', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const fullyDocumentedCode = `
/**
 * Function 1 documentation
 */
function func1() { return 1; }

/**
 * Function 2 documentation
 */
function func2() { return 2; }

/**
 * Function 3 documentation
 */
function func3() { return 3; }

/**
 * Class 1 documentation
 */
class Class1 {
  constructor() {}
}

/**
 * Class 2 documentation
 */
class Class2 {
  constructor() {}
}

/**
 * Interface 1 documentation
 */
interface Interface1 {
  prop: string;
}

/**
 * Interface 2 documentation
 */
interface Interface2 {
  prop: number;
}

/**
 * Type 1 documentation
 */
type Type1 = string;

/**
 * Type 2 documentation
 */
type Type2 = number;

/**
 * Exported function documentation
 */
export function exportedFunc() {}

/**
 * Exported class documentation
 */
export class ExportedClass {}

/**
 * Exported interface documentation
 */
export interface ExportedInterface { prop: boolean }

/**
 * Exported type documentation
 */
export type ExportedType = object;
`;

      await fs.writeFile(join(srcDir, 'fully-documented.ts'), fullyDocumentedCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(100);
      expect(result.documentation.style).toBe('jsdoc');
    });

    it('should calculate exact percentages for partial documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Test 25% coverage - 1 out of 4 documented
      const quarterDocumentedCode = `
/**
 * Documented function 1
 */
function func1() { return 1; }

function func2() { return 2; }
function func3() { return 3; }
function func4() { return 4; }
`;

      await fs.writeFile(join(srcDir, 'quarter.js'), quarterDocumentedCode);

      // Test 50% coverage - 2 out of 4 documented
      const halfDocumentedCode = `
/**
 * Documented function 1
 */
function func1() { return 1; }

/**
 * Documented function 2
 */
function func2() { return 2; }

function func3() { return 3; }
function func4() { return 4; }
`;

      await fs.writeFile(join(srcDir, 'half.js'), halfDocumentedCode);

      // Test 75% coverage - 3 out of 4 documented
      const threeQuartersCode = `
/**
 * Documented function 1
 */
function func1() { return 1; }

/**
 * Documented function 2
 */
function func2() { return 2; }

/**
 * Documented function 3
 */
function func3() { return 3; }

function func4() { return 4; }
`;

      await fs.writeFile(join(srcDir, 'three-quarters.js'), threeQuartersCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Total: 6 documented out of 12 functions = 50%
      expect(result.documentation.coverage).toBe(50);
    });

    it('should handle rounding correctly for coverage percentages', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Test with 7 functions where 2 are documented = 28.57% -> should round to 29
      const roundingCode = `
/**
 * Documented function 1
 */
function func1() { return 1; }

/**
 * Documented function 2
 */
function func2() { return 2; }

function func3() { return 3; }
function func4() { return 4; }
function func5() { return 5; }
function func6() { return 6; }
function func7() { return 7; }
`;

      await fs.writeFile(join(srcDir, 'rounding.js'), roundingCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(29); // 2/7 = 28.57% rounds to 29%
    });
  });

  describe('Documentable Element Detection', () => {
    it('should correctly identify all documentable function types', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const functionTypesCode = `
// Function declarations
/**
 * Regular function declaration
 */
function regularFunction() {}

/**
 * Async function declaration
 */
async function asyncFunction() {}

/**
 * Generator function declaration
 */
function* generatorFunction() {}

/**
 * Async generator function declaration
 */
async function* asyncGeneratorFunction() {}

// Function expressions
/**
 * Function expression assigned to const
 */
const functionExpression = function() {};

/**
 * Named function expression
 */
const namedFunctionExpression = function namedFunc() {};

/**
 * Arrow function expression
 */
const arrowFunction = () => {};

/**
 * Async arrow function
 */
const asyncArrowFunction = async () => {};

// Exported functions
/**
 * Exported function declaration
 */
export function exportedFunction() {}

/**
 * Exported async function
 */
export async function exportedAsyncFunction() {}

/**
 * Default export function
 */
export default function defaultFunction() {}

// Should NOT be documented/counted:
// - IIFE (Immediately Invoked Function Expressions)
(function() {
  // This should not count
})();

(() => {
  // This should not count
})();

// - Callback functions in method calls
setTimeout(function() {
  // This should not count
}, 1000);

setTimeout(() => {
  // This should not count
}, 1000);

// Undocumented functions that should count in coverage calculation
function undocumented1() {}
const undocumented2 = () => {};
export function undocumentedExported() {}
`;

      await fs.writeFile(join(srcDir, 'function-types.js'), functionTypesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should detect 13 documentable functions (10 documented + 3 undocumented that should count)
      // Coverage: 10/13 = 76.9% -> rounds to 77%
      expect(result.documentation.coverage).toBe(77);
    });

    it('should correctly identify all documentable class types', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const classTypesCode = `
/**
 * Regular class
 */
class RegularClass {
  constructor() {}
}

/**
 * Abstract class
 */
abstract class AbstractClass {
  abstract abstractMethod(): void;
  concreteMethod() {}
}

/**
 * Generic class
 */
class GenericClass<T> {
  data: T;
}

/**
 * Extended class
 */
class ExtendedClass extends RegularClass {
  additionalMethod() {}
}

/**
 * Exported class
 */
export class ExportedClass {}

/**
 * Default export class
 */
export default class DefaultClass {}

/**
 * Class with decorators
 */
@decorator
class DecoratedClass {}

// Undocumented classes that should count
class UndocumentedClass1 {}
abstract class UndocumentedAbstract {}
export class UndocumentedExported {}

// Should NOT count as documentable elements:
// - Class expressions (if they exist in TypeScript/JavaScript)
const ClassExpression = class {
  // This is less common and our regex might not catch it
};
`;

      await fs.writeFile(join(srcDir, 'class-types.ts'), classTypesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should detect classes (7 documented + 3 undocumented = 10 total)
      // Coverage: 7/10 = 70%
      expect(result.documentation.coverage).toBe(70);
    });

    it('should correctly identify TypeScript-specific documentable elements', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typescriptElementsCode = `
/**
 * Interface documentation
 */
interface DocumentedInterface {
  prop: string;
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
interface ExtendedInterface extends DocumentedInterface {
  additional: number;
}

/**
 * Type alias documentation
 */
type DocumentedType = string | number;

/**
 * Generic type alias
 */
type GenericType<T> = {
  data: T;
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
  VALUE1 = 'value1',
  VALUE2 = 'value2'
}

/**
 * Const enum
 */
const enum DocumentedConstEnum {
  A = 1,
  B = 2
}

/**
 * Namespace
 */
namespace DocumentedNamespace {
  export function nestedFunction() {}
}

// Undocumented TypeScript elements
interface UndocumentedInterface {
  prop: boolean;
}

type UndocumentedType = object;

enum UndocumentedEnum {
  VAL1,
  VAL2
}

// Complex undocumented types
type ComplexUndocumented<T, U> = T extends U ? never : T;
interface ComplexUndocumentedInterface<T> extends DocumentedInterface {
  complex: T;
}
`;

      await fs.writeFile(join(srcDir, 'typescript-elements.ts'), typescriptElementsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should count all interfaces, types, enums, namespaces
      // Total documentable: 10 documented + 5 undocumented = 15
      // Coverage: 10/15 = 66.7% -> rounds to 67%
      expect(result.documentation.coverage).toBe(67);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle mixed file types with different documentable elements', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // JavaScript file
      const jsFile = `
/**
 * JS function
 */
function jsFunction() {}

/**
 * JS class
 */
class JSClass {}

function undocumentedJS() {}
`;

      // TypeScript file
      const tsFile = `
/**
 * TS function
 */
function tsFunction(): void {}

/**
 * TS interface
 */
interface TSInterface {
  prop: string;
}

/**
 * TS type
 */
type TSType = number;

function undocumentedTSFunction() {}
interface UndocumentedTSInterface {
  prop: boolean;
}
`;

      // Vue file
      const vueFile = `
<template>
  <div>Vue component</div>
</template>

<script>
/**
 * Vue component
 */
export default {
  name: 'TestComponent',
  methods: {
    /**
     * Vue method
     */
    documentedMethod() {},

    undocumentedMethod() {}
  }
}
</script>
`;

      await fs.writeFile(join(srcDir, 'test.js'), jsFile);
      await fs.writeFile(join(srcDir, 'test.ts'), tsFile);
      await fs.writeFile(join(srcDir, 'TestComponent.vue'), vueFile);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Total across all files should be counted correctly
      expect(result.documentation.coverage).toBeGreaterThan(50);
      expect(result.documentation.coverage).toBeLessThan(90);
    });

    it('should handle documentation that spans multiple lines with gaps', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const gappedDocumentationCode = `
/**
 * Function with documentation that has gaps
 */


function functionWithGaps() {}

/**
 * Function with immediate documentation
 */
function immediateDoc() {}

// Comment that's not documentation

/**
 * Function after non-doc comment
 */
function afterComment() {}

/**
 * Multi-line documentation
 * with lots of content
 * and detailed explanation
 */



function withMultipleGaps() {}

function undocumented() {}

// This comment is not for the next function
// It's just a general comment

function notForThis() {}

/**
 * Properly documented function
 */
function properlyDocumented() {}
`;

      await fs.writeFile(join(srcDir, 'gapped-docs.js'), gappedDocumentationCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should correctly identify which functions have proper documentation
      expect(result.documentation.coverage).toBeGreaterThan(60);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
    });

    it('should handle nested and complex code structures', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const nestedStructuresCode = `
/**
 * Outer function with nested structures
 */
function outerFunction() {
  // Nested function - should NOT count as documentable
  function nestedFunction() {
    return 'nested';
  }

  // Nested arrow function - should NOT count as documentable
  const nestedArrow = () => {
    return 'nested arrow';
  };

  return {
    // Method in returned object - should NOT count as documentable
    method: function() {
      return 'method';
    },

    // Arrow method in returned object - should NOT count as documentable
    arrowMethod: () => {
      return 'arrow method';
    }
  };
}

/**
 * Class with various method types
 */
class ComplexClass {
  /**
   * Constructor - counted separately from class
   */
  constructor() {
    // Arrow function in constructor - should NOT count
    this.callback = () => {
      return 'callback';
    };
  }

  // Method - classes themselves are documentable, not individual methods in our current implementation
  method() {
    // Nested function in method - should NOT count
    function helperFunction() {
      return 'helper';
    }
  }
}

/**
 * Function that returns a function
 */
function higherOrderFunction() {
  // Returned function - should NOT count as documentable
  return function(param) {
    return param * 2;
  };
}

/**
 * Function with callbacks
 */
function functionWithCallbacks() {
  // Callback functions should NOT count as documentable
  setTimeout(function() {
    console.log('timeout');
  }, 1000);

  // Arrow callback should NOT count as documentable
  setTimeout(() => {
    console.log('arrow timeout');
  }, 2000);
}

// Undocumented functions that should count
function undocumented1() {}
class UndocumentedClass {}

// IIFE should NOT count as documentable
(function() {
  console.log('IIFE');
})();
`;

      await fs.writeFile(join(srcDir, 'nested-structures.js'), nestedStructuresCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      // Should only count top-level documentable elements:
      // outerFunction, ComplexClass, higherOrderFunction, functionWithCallbacks, undocumented1, UndocumentedClass
      // 4 documented out of 6 total = 66.7% -> rounds to 67%
      expect(result.documentation.coverage).toBe(67);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle files with no documentable elements', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noDocumentableCode = `
// Just constants and variables
const API_URL = 'https://api.example.com';
const TIMEOUT = 5000;
let currentUser = null;

// Object literals
const config = {
  debug: true,
  version: '1.0.0'
};

// Arrays
const supportedFormats = ['json', 'xml', 'yaml'];

// Imports and exports
import { utils } from './utils';
export { config };

// Comments that don't document anything
// This is just a general comment
/* Block comment */

console.log('Module loaded');
`;

      await fs.writeFile(join(srcDir, 'no-documentable.js'), noDocumentableCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(0);
      expect(result.documentation.style).toBe('none');
    });

    it('should handle very large numbers of documentable elements', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Generate a large file with many documentable elements
      let largeFileContent = '// Large file with many documentable elements\n\n';

      // Add 50 functions (25 documented, 25 undocumented)
      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          largeFileContent += `
/**
 * Function ${i} documentation
 */
function func${i}() {
  return ${i};
}
`;
        } else {
          largeFileContent += `
function func${i}() {
  return ${i};
}
`;
        }
      }

      // Add 20 classes (10 documented, 10 undocumented)
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          largeFileContent += `
/**
 * Class ${i} documentation
 */
class Class${i} {
  constructor() {}
}
`;
        } else {
          largeFileContent += `
class Class${i} {
  constructor() {}
}
`;
        }
      }

      // Add 30 interfaces and types (15 documented, 15 undocumented)
      for (let i = 0; i < 30; i++) {
        if (i % 2 === 0) {
          largeFileContent += `
/**
 * Interface ${i} documentation
 */
interface Interface${i} {
  prop${i}: string;
}
`;
        } else {
          largeFileContent += `
interface Interface${i} {
  prop${i}: number;
}
`;
        }
      }

      await fs.writeFile(join(srcDir, 'large-file.ts'), largeFileContent);

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const endTime = Date.now();

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // 50 documented out of 100 total = 50%
      expect(result.documentation.coverage).toBe(50);
      expect(result.documentation.style).toBe('jsdoc');

      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });
});