/**
 * Performance and Stress Tests for Symbol Extractors
 *
 * Tests the performance characteristics, memory usage patterns,
 * and stress scenarios for the symbol extraction system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExtractorForLanguage,
  SymbolKind,
  type ExtractionResult
} from '../index.js';
import { TypeScriptExtractor } from '../typescript-extractor.js';
import { PythonExtractor } from '../python-extractor.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('Symbol Extractor Performance', () => {
  beforeEach(() => {
    // Reset singleton instances before each test
    TypeScriptExtractor.resetInstance?.();
    PythonExtractor.resetInstance?.();
  });

  afterEach(() => {
    // Clean up after each test
    TypeScriptExtractor.resetInstance?.();
    PythonExtractor.resetInstance?.();
  });

  describe('Timing measurements', () => {
    it('should complete simple extraction within reasonable time', async () => {
      const simpleCode = `
        function simpleFunction() {
          return 'hello';
        }

        class SimpleClass {
          method() {}
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const startTime = Date.now();

      const result = await extractor.extract(simpleCode, SupportedLanguage.TypeScript);

      const endTime = Date.now();
      const actualTime = endTime - startTime;

      expect(result.extractionTimeMs).toBeGreaterThan(0);
      expect(result.extractionTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
      expect(actualTime).toBeLessThan(10000); // Total time including overhead
    });

    it('should show consistent timing for similar code', async () => {
      const codeTemplate = (i: number) => `
        function function${i}(param: number): number {
          return param * ${i};
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const results: ExtractionResult[] = [];

      // Run multiple extractions of similar complexity
      for (let i = 0; i < 10; i++) {
        const result = await extractor.extract(
          codeTemplate(i),
          SupportedLanguage.TypeScript
        );
        results.push(result);
      }

      // Calculate timing statistics
      const times = results.map(r => r.extractionTimeMs);
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      expect(avgTime).toBeGreaterThan(0);
      expect(maxTime).toBeLessThan(1000); // Max should be reasonable
      expect(maxTime / minTime).toBeLessThan(10); // Variance shouldn't be too high
    });

    it('should scale reasonably with code size', async () => {
      const generateCode = (functionCount: number) => {
        return Array.from({ length: functionCount }, (_, i) =>
          `function func${i}(x: number): number { return x + ${i}; }`
        ).join('\n');
      };

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const results: { functionCount: number; time: number }[] = [];

      // Test with increasing code size
      for (const count of [10, 50, 100, 200]) {
        const code = generateCode(count);
        const result = await extractor.extract(code, SupportedLanguage.TypeScript);

        expect(result.symbols).toHaveLength(count);
        results.push({ functionCount: count, time: result.extractionTimeMs });
      }

      // Verify that time scales reasonably (not exponentially)
      const time10 = results.find(r => r.functionCount === 10)!.time;
      const time200 = results.find(r => r.functionCount === 200)!.time;

      // 200 functions shouldn't take more than 50x the time of 10 functions
      expect(time200 / time10).toBeLessThan(50);
    });
  });

  describe('Memory usage patterns', () => {
    it('should handle repeated extractions without memory leaks', async () => {
      const code = `
        function testFunction(param: string): void {
          console.log(param);
        }

        class TestClass {
          private value: number = 0;

          getValue(): number {
            return this.value;
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Perform many extractions to detect potential memory leaks
      for (let i = 0; i < 100; i++) {
        const result = await extractor.extract(code, SupportedLanguage.TypeScript);

        expect(result.symbols).toHaveLength(2);
        expect(result.symbols[0].name).toBe('testFunction');
        expect(result.symbols[1].name).toBe('TestClass');

        // Clear references to help detect leaks
        result.symbols.length = 0;
      }

      // If we reach here without crashing or excessive memory usage, we're good
      expect(true).toBe(true);
    });

    it('should handle large symbol hierarchies efficiently', async () => {
      // Generate a class with many methods and properties
      const generateLargeClass = (methodCount: number) => `
        class LargeClass {
          ${Array.from({ length: methodCount }, (_, i) => `
            method${i}(param${i}: number): string {
              return \`result\${param${i}}\`;
            }
          `).join('')}
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const code = generateLargeClass(100);

      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const largeClass = result.symbols[0];
      expect(largeClass.name).toBe('LargeClass');
      expect(largeClass.children).toHaveLength(100);
      expect(result.extractionTimeMs).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Stress testing', () => {
    it('should handle extremely long lines', async () => {
      const longLine = 'a'.repeat(10000);
      const codeWithLongLine = `
        function test() {
          const longString = "${longLine}";
          return longString;
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(codeWithLongLine, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe('test');
    });

    it('should handle many deeply nested objects', async () => {
      const generateNestedObject = (depth: number): string => {
        let code = 'const deepObject = {\n';

        for (let i = 0; i < depth; i++) {
          code += `  level${i}: {\n`;
        }

        code += '    value: 42\n';

        for (let i = 0; i < depth; i++) {
          code += '  }\n';
        }

        code += '};\n';
        return code;
      };

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const code = generateNestedObject(50); // 50 levels of nesting

      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.extractionTimeMs).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle many parameters in function signatures', async () => {
      const generateFunctionWithManyParams = (paramCount: number) => {
        const params = Array.from({ length: paramCount }, (_, i) =>
          `param${i}: number`
        ).join(', ');

        return `
          function functionWithManyParams(${params}): number {
            return ${Array.from({ length: paramCount }, (_, i) => `param${i}`).join(' + ')};
          }
        `;
      };

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const code = generateFunctionWithManyParams(100); // 100 parameters

      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe('functionWithManyParams');
      expect(result.symbols[0].signature).toContain('param0: number');
      expect(result.symbols[0].signature).toContain('param99: number');
    });

    it('should handle mixed language patterns in comments', async () => {
      const mixedLanguageCode = `
        /**
         * This function handles multiple languages:
         * English: Hello World
         * 中文: 你好世界
         * 日本語: こんにちは世界
         * العربية: مرحبا بالعالم
         * עברית: שלום עולם
         * Русский: Привет мир
         * 🌍🌎🌏 Emoji support
         */
        function multiLanguageFunction(): string {
          return "Hello World in multiple languages";
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(mixedLanguageCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].documentation).toContain('multiple languages');
      expect(result.symbols[0].documentation).toContain('你好世界');
      expect(result.symbols[0].documentation).toContain('🌍');
    });
  });

  describe('Concurrent processing', () => {
    it('should handle concurrent extractions of different languages', async () => {
      const tsCode = `
        export function tsFunction(): string {
          return "TypeScript";
        }
      `;

      const pythonCode = `
        def python_function():
            """Python function"""
            return "Python"
      `;

      const promises = [
        getExtractorForLanguage(SupportedLanguage.TypeScript)
          .extract(tsCode, SupportedLanguage.TypeScript),
        getExtractorForLanguage(SupportedLanguage.Python)
          .extract(pythonCode, SupportedLanguage.Python),
        getExtractorForLanguage(SupportedLanguage.JavaScript)
          .extract(tsCode, SupportedLanguage.JavaScript) // JS can parse TS-like syntax
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.symbols).toHaveLength(1);
        expect(result.extractionTimeMs).toBeGreaterThan(0);
      }

      expect(results[0].language).toBe('typescript');
      expect(results[1].language).toBe('python');
      expect(results[2].language).toBe('javascript');
    });

    it('should maintain singleton pattern under concurrent access', async () => {
      const promises = Array.from({ length: 20 }, () =>
        Promise.resolve(getExtractorForLanguage(SupportedLanguage.TypeScript))
      );

      const extractors = await Promise.all(promises);

      // All extractors should be the same instance
      const firstExtractor = extractors[0];
      for (const extractor of extractors) {
        expect(extractor).toBe(firstExtractor);
      }
    });
  });

  describe('Resource consumption', () => {
    it('should report reasonable symbol counts', async () => {
      const code = `
        // 1 function
        function func1() {}

        // 1 arrow function
        const func2 = () => {};

        // 1 class with 3 members (constructor + 2 methods)
        class TestClass {
          constructor() {}
          method1() {}
          method2() {}
        }

        // 1 interface with 2 properties
        interface TestInterface {
          prop1: string;
          prop2: number;
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbolCount).toBeDefined();

      if (result.symbolCount !== undefined) {
        // Should count all symbols including nested ones
        expect(result.symbolCount).toBeGreaterThanOrEqual(4); // At least top-level symbols
        expect(result.symbolCount).toBeLessThanOrEqual(10); // Reasonable upper bound
      }
    });

    it('should handle extraction options efficiently', async () => {
      const complexCode = `
        /**
         * Complex function with documentation
         */
        export function complexFunction(param: string): Promise<void> {
          console.log(param);
        }

        /**
         * Complex class with private members
         */
        export class ComplexClass {
          private privateField: number = 0;
          public publicField: string = "";

          constructor(value: number) {
            this.privateField = value;
          }

          private privateMethod(): void {}
          public publicMethod(): void {}

          get value(): number {
            return this.privateField;
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test multiple option combinations for performance
      const optionSets = [
        { includePrivate: false },
        { includeDocumentation: false },
        { includeSignatures: false },
        { maxDepth: 0 },
        { symbolKinds: [SymbolKind.Function] },
        { includePrivate: false, includeDocumentation: false, maxDepth: 0 }
      ];

      for (const options of optionSets) {
        const startTime = Date.now();
        const result = await extractor.extract(complexCode, SupportedLanguage.TypeScript, options);
        const endTime = Date.now();

        expect(result).toBeDefined();
        expect(endTime - startTime).toBeLessThan(5000); // Should be fast with options
      }
    });
  });
});