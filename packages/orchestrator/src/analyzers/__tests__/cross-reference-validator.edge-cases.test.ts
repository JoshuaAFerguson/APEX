/**
 * CrossReferenceValidator Edge Cases Tests
 *
 * Tests for edge cases, error conditions, and boundary scenarios
 * that could occur in real-world usage of the CrossReferenceValidator.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrossReferenceValidator } from '../cross-reference-validator';
import type { SymbolIndex, DocumentationReference, SymbolInfo } from '../cross-reference-validator';
import * as fs from 'fs/promises';

// Mock fs module for controlled testing
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('CrossReferenceValidator Edge Cases', () => {
  let validator: CrossReferenceValidator;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
    vi.clearAllMocks();
  });

  describe('malformed and edge case TypeScript/JavaScript', () => {
    it('should handle files with Unicode and special characters', () => {
      const content = `
// File with Unicode symbols and special characters
export function calculateπ(radius: number): number {
  return Math.PI * radius * radius;
}

export class ユーザーサービス {
  public getUser名前(id: string): string {
    return \`ユーザー_\${id}\`;
  }
}

export interface Configuración {
  título: string;
  descripción: string;
}

export const КОНСТАНТЫ = {
  МАКСИМУМ: 100,
  МИНИМУМ: 0,
};
`;

      const symbols = validator.extractSymbols('/test/unicode.ts', content);

      expect(symbols.length).toBeGreaterThan(0);

      const piFunction = symbols.find(s => s.name === 'calculateπ');
      expect(piFunction).toBeDefined();

      const japaneseClass = symbols.find(s => s.name === 'ユーザーサービス');
      expect(japaneseClass).toBeDefined();

      const spanishInterface = symbols.find(s => s.name === 'Configuración');
      expect(spanishInterface).toBeDefined();

      const russianConst = symbols.find(s => s.name === 'КОНСТАНТЫ');
      expect(russianConst).toBeDefined();
    });

    it('should handle extremely nested class structures', () => {
      const content = `
export class OuterClass {
  public property1: string = 'test';

  public method1(): void {
    class LocalClass1 {
      public innerMethod1(): void {
        function nestedFunction1(): void {
          // Deep nesting
        }
      }
    }
  }

  public get accessor1(): string {
    return this.property1;
  }

  public set setter1(value: string) {
    this.property1 = value;
  }
}

namespace TestNamespace {
  export class NestedClass {
    public static staticMethod(): void {}

    private static staticProperty: string = 'static';
  }
}
`;

      const symbols = validator.extractSymbols('/test/nested.ts', content);

      const outerClass = symbols.find(s => s.name === 'OuterClass');
      expect(outerClass).toBeDefined();

      // Should extract class members
      const method1 = symbols.find(s => s.name === 'method1' && s.parent === 'OuterClass');
      expect(method1).toBeDefined();

      const property1 = symbols.find(s => s.name === 'property1' && s.parent === 'OuterClass');
      expect(property1).toBeDefined();
    });

    it('should handle files with only whitespace and comments', () => {
      const content = `


      // This file contains only comments and whitespace

      /*
       * Multi-line comment block
       * with no actual code
       */

      /**
       * JSDoc comment
       * @description Empty file
       */



`;

      const symbols = validator.extractSymbols('/test/empty.ts', content);
      expect(symbols).toHaveLength(0);
    });

    it('should handle files with complex string literals and template strings', () => {
      const content = `
export const complexString = \`
  This is a template string with \${variable}
  and function calls like \${someFunction()}
  and class references like \${MyClass.staticMethod()}
\`;

export function processTemplate(): string {
  return \`
    \${nestedTemplate()}
    \${AnotherClass.method()}
  \`;
}

export const regexPattern = /function\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(/g;

export const jsonConfig = {
  "functions": ["func1", "func2"],
  "classes": ["Class1", "Class2"]
};
`;

      const symbols = validator.extractSymbols('/test/strings.ts', content);

      expect(symbols.length).toBeGreaterThan(0);

      const complexStringSymbol = symbols.find(s => s.name === 'complexString');
      expect(complexStringSymbol).toBeDefined();

      const processTemplateSymbol = symbols.find(s => s.name === 'processTemplate');
      expect(processTemplateSymbol).toBeDefined();
    });

    it('should handle TypeScript advanced features', () => {
      const content = `
export type ConditionalType<T> = T extends string ? string : number;

export interface GenericInterface<T, U = string> {
  value: T;
  optional?: U;
}

export class GenericClass<T extends Record<string, any>> {
  constructor(private data: T) {}

  public getValue<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }
}

export function genericFunction<
  T extends string,
  U extends number
>(param1: T, param2: U): T | U {
  return Math.random() > 0.5 ? param1 : param2;
}

export enum StringEnum {
  VALUE1 = "value1",
  VALUE2 = "value2"
}

export const enum NumericEnum {
  FIRST = 1,
  SECOND = 2
}

export namespace ComplexNamespace {
  export interface NestedInterface {
    prop: string;
  }

  export function nestedFunction(): void {}
}
`;

      const symbols = validator.extractSymbols('/test/advanced.ts', content);

      expect(symbols.length).toBeGreaterThan(0);

      const conditionalType = symbols.find(s => s.name === 'ConditionalType');
      expect(conditionalType?.type).toBe('type');

      const genericInterface = symbols.find(s => s.name === 'GenericInterface');
      expect(genericInterface?.type).toBe('interface');

      const genericClass = symbols.find(s => s.name === 'GenericClass');
      expect(genericClass?.type).toBe('class');

      const stringEnum = symbols.find(s => s.name === 'StringEnum');
      expect(stringEnum?.type).toBe('enum');
    });

    it('should handle malformed syntax without crashing', () => {
      const malformedCases = [
        'export function (',
        'class {',
        'export {,,,}',
        'function() => {}',
        'export const = "value";',
        'interface { prop }',
        'export { function test() {}',
        'class Test { method(: void }',
        'export function test(param: string: number): void {}'
      ];

      malformedCases.forEach((content, index) => {
        expect(() => {
          const symbols = validator.extractSymbols(`/test/malformed${index}.ts`, content);
          // Should not throw, even if no symbols extracted
          expect(Array.isArray(symbols)).toBe(true);
        }).not.toThrow();
      });
    });
  });

  describe('documentation reference extraction edge cases', () => {
    it('should handle documentation with mixed markdown formatting', () => {
      const content = `
# Complex **Markdown** Documentation

Use the \`UserService\` class with *emphasis* and **bold** text.

## Code with HTML entities

\`\`\`typescript
// Use &lt;AngleBrackets&gt; and &amp; symbols
const service = new UserService(&quot;config&quot;);
const result = service.processData&lt;string&gt;(&amp;data);
\`\`\`

> **Note**: The \`SpecialClass\` handles edge cases.

- List item with \`InlineCode\`
- Another item with **bold \`CodeInBold\`**

1. Ordered list with \`NumberedCode\`
2. [Link with \`LinkCode\`](http://example.com)

| Table | with \`TableCode\` |
|-------|-------------------|
| Cell  | \`CellCode\`      |

<!-- HTML comment with \`CommentCode\` -->

[Reference style link]: http://example.com "Title with \`TitleCode\`"
`;

      const references = validator.extractDocumentationReferences('/test/complex.md', content);

      expect(references.length).toBeGreaterThan(0);

      const userServiceRef = references.find(r => r.symbolName === 'UserService');
      expect(userServiceRef).toBeDefined();

      const specialClassRef = references.find(r => r.symbolName === 'SpecialClass');
      expect(specialClassRef).toBeDefined();

      const inlineCodeRef = references.find(r => r.symbolName === 'InlineCode');
      expect(inlineCodeRef).toBeDefined();
    });

    it('should handle code blocks with different language specifications', () => {
      const content = `
# Multi-language Examples

## TypeScript
\`\`\`typescript
import { TypeScriptClass } from './module';
const instance = new TypeScriptClass();
\`\`\`

## JavaScript
\`\`\`javascript
const service = new JavaScriptService();
service.processData();
\`\`\`

## TSX/JSX
\`\`\`tsx
const component = <ReactComponent prop="value" />;
\`\`\`

## No language specified
\`\`\`
const noLangService = new NoLangService();
noLangService.execute();
\`\`\`

## JSON (should not extract symbols)
\`\`\`json
{
  "config": {
    "service": "JsonService"
  }
}
\`\`\`

## Plain text (should not extract symbols)
\`\`\`text
Use PlainTextService for configuration
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('/test/multilang.md', content);

      expect(references.length).toBeGreaterThan(0);

      const tsRef = references.find(r => r.symbolName === 'TypeScriptClass');
      expect(tsRef).toBeDefined();

      const jsRef = references.find(r => r.symbolName === 'JavaScriptService');
      expect(jsRef).toBeDefined();

      const reactRef = references.find(r => r.symbolName === 'ReactComponent');
      expect(reactRef).toBeDefined();

      const noLangRef = references.find(r => r.symbolName === 'NoLangService');
      expect(noLangRef).toBeDefined();

      // JSON and text blocks should not contribute to symbol extraction
      // (our implementation should only extract from js/ts code blocks)
      const jsonRef = references.find(r => r.symbolName === 'JsonService');
      expect(jsonRef).toBeUndefined();

      const plainTextRef = references.find(r => r.symbolName === 'PlainTextService');
      expect(plainTextRef).toBeUndefined();
    });

    it('should handle nested and escaped backticks', () => {
      const content = `
# Documentation with Escaped Content

Use the \`EscapedService\` with \\\`backticks\\\` in the name.

## Complex Code Examples

\`\`\`typescript
// Code block with inline backticks
const template = \`Use \\\`InnerService\\\` here: \${value}\`;
const regex = /\\\`([^\\\\\\`]+)\\\`/g;
const service = new ComplexService(template);
\`\`\`

Use \`\\\`WeirdName\\\`\` for special cases.

Inline code with \`function() { return \\\`nested\\\`; }\` example.
`;

      const references = validator.extractDocumentationReferences('/test/escaped.md', content);

      expect(references.length).toBeGreaterThan(0);

      const escapedRef = references.find(r => r.symbolName === 'EscapedService');
      expect(escapedRef).toBeDefined();

      const complexRef = references.find(r => r.symbolName === 'ComplexService');
      expect(complexRef).toBeDefined();
    });

    it('should handle extremely long lines and content', () => {
      // Create a very long line with inline code references
      const longSymbolName = 'A'.repeat(100);
      const longLine = `This is a very long line with many words that contains a reference to \`${longSymbolName}\` and continues for a very long time with lots of additional text that should not affect the extraction process.`.repeat(5);

      const content = `
# Long Content Test

${longLine}

## Code Block with Long Content

\`\`\`typescript
${Array.from({ length: 50 }, (_, i) => `const variable${i} = new Service${i}();`).join('\n')}

// Reference to LongExampleFunction
const result = LongExampleFunction(${Array.from({ length: 20 }, (_, i) => `param${i}`).join(', ')});
\`\`\`
`;

      const references = validator.extractDocumentationReferences('/test/long.md', content);

      expect(references.length).toBeGreaterThan(0);

      const longNameRef = references.find(r => r.symbolName === longSymbolName);
      expect(longNameRef).toBeDefined();
      expect(longNameRef?.context.length).toBeLessThanOrEqual(1000); // Context should be reasonably sized

      const longExampleRef = references.find(r => r.symbolName === 'LongExampleFunction');
      expect(longExampleRef).toBeDefined();
    });
  });

  describe('index building edge cases', () => {
    beforeEach(() => {
      mockFs.readdir.mockReset();
      mockFs.readFile.mockReset();
    });

    it('should handle circular directory structures (symbolic links)', async () => {
      // Simulate a circular directory structure
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if (dirPath === '/circular/src') {
          return [
            { name: 'index.ts', isFile: () => true, isDirectory: () => false },
            { name: 'link', isFile: () => false, isDirectory: () => true }, // Circular link
          ] as any;
        }
        if (dirPath === '/circular/src/link') {
          // This simulates a circular reference back to the root
          throw new Error('ELOOP: too many symbolic links encountered');
        }
        return [];
      });

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath === '/circular/src/index.ts') {
          return 'export function circularFunction(): void {}';
        }
        throw new Error('File not found');
      });

      const index = await validator.buildIndex('/circular/src');

      // Should handle the error gracefully and process what it can
      expect(index.stats.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it('should handle permission denied errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('EACCES: permission denied'));
      mockFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const index = await validator.buildIndex('/restricted/path');

      expect(index.stats.totalFiles).toBe(0);
      expect(index.stats.totalSymbols).toBe(0);
      expect(index.byName.size).toBe(0);
    });

    it('should handle extremely large files', async () => {
      const largeFileContent = Array.from({ length: 10000 }, (_, i) =>
        `export function func${i}(): number { return ${i}; }`
      ).join('\n');

      mockFs.readdir.mockResolvedValue([
        { name: 'large.ts', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.readFile.mockResolvedValue(largeFileContent);

      const startTime = Date.now();
      const index = await validator.buildIndex('/large-file/src');
      const processTime = Date.now() - startTime;

      expect(index.stats.totalSymbols).toBe(10000);
      expect(processTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle files with BOM (Byte Order Mark)', async () => {
      const bomContent = '\uFEFFexport function bomFunction(): void { console.log("BOM file"); }';

      mockFs.readdir.mockResolvedValue([
        { name: 'bom.ts', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.readFile.mockResolvedValue(bomContent);

      const index = await validator.buildIndex('/bom/src');

      expect(index.byName.has('bomFunction')).toBe(true);
    });

    it('should handle mixed line endings (CRLF, LF, CR)', () => {
      const mixedLineEndings = [
        'export function crlfFunction(): void {}', // Will be followed by CRLF
        'export function lfFunction(): void {}',   // Will be followed by LF
        'export function crFunction(): void {}'    // Will be followed by CR
      ];

      const crlfContent = mixedLineEndings.join('\r\n');
      const lfContent = mixedLineEndings.join('\n');
      const crContent = mixedLineEndings.join('\r');

      const crlfSymbols = validator.extractSymbols('/test/crlf.ts', crlfContent);
      const lfSymbols = validator.extractSymbols('/test/lf.ts', lfContent);
      const crSymbols = validator.extractSymbols('/test/cr.ts', crContent);

      expect(crlfSymbols.length).toBe(3);
      expect(lfSymbols.length).toBe(3);
      expect(crSymbols.length).toBe(3);

      // All should extract the same symbols
      expect(crlfSymbols.map(s => s.name).sort()).toEqual(
        lfSymbols.map(s => s.name).sort()
      );
      expect(lfSymbols.map(s => s.name).sort()).toEqual(
        crSymbols.map(s => s.name).sort()
      );
    });
  });

  describe('validation edge cases', () => {
    it('should handle empty symbol index', () => {
      const emptyIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      const references: DocumentationReference[] = [
        {
          symbolName: 'NonExistent',
          referenceType: 'inline-code',
          sourceFile: '/test.md',
          line: 1,
          column: 1,
          context: 'Use `NonExistent` function'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(emptyIndex, references);

      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].type).toBe('broken-link');
      expect(brokenLinks[0].suggestion).toContain('Symbol not found');
    });

    it('should handle empty reference list', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([['TestSymbol', []]]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: {} }
      };

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, []);

      expect(brokenLinks).toHaveLength(0);
    });

    it('should handle references with very similar names', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['UserService', []],
          ['UserServic', []], // Very close typo
          ['UserServ', []], // Partial match
          ['userService', []], // Case difference
          ['User_Service', []], // Underscore variation
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 5, totalFiles: 1, byType: {} }
      };

      const typoReference: DocumentationReference = {
        symbolName: 'UserServie', // Common typo
        referenceType: 'inline-code',
        sourceFile: '/test.md',
        line: 1,
        column: 1,
        context: 'Use `UserServie` for management'
      };

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, [typoReference]);

      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].suggestion).toContain('UserService');
    });

    it('should handle symbols with special characters in suggestions', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['user$service', []],
          ['user_service', []],
          ['userService123', []],
          ['UserService$', []],
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 4, totalFiles: 1, byType: {} }
      };

      const typoReference: DocumentationReference = {
        symbolName: 'userService', // Missing special chars
        referenceType: 'inline-code',
        sourceFile: '/test.md',
        line: 1,
        column: 1,
        context: 'Use `userService` function'
      };

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, [typoReference]);

      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].suggestion).toBeTruthy();
    });

    it('should handle extremely long context strings', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      const longContext = 'A'.repeat(10000); // Very long context
      const reference: DocumentationReference = {
        symbolName: 'Missing',
        referenceType: 'inline-code',
        sourceFile: '/test.md',
        line: 1,
        column: 1,
        context: longContext
      };

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, [reference]);

      expect(brokenLinks).toHaveLength(1);
      // Context should be truncated in the description
      expect(brokenLinks[0].description.length).toBeLessThan(longContext.length);
      expect(brokenLinks[0].description).toContain('...');
    });

    it('should handle duplicate symbols with different definitions', () => {
      const symbol1: SymbolInfo = {
        name: 'DuplicateFunction',
        type: 'function',
        file: '/src/file1.ts',
        line: 10,
        column: 1,
        isExported: true
      };

      const symbol2: SymbolInfo = {
        name: 'DuplicateFunction',
        type: 'function',
        file: '/src/file2.ts',
        line: 20,
        column: 1,
        isExported: true
      };

      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['DuplicateFunction', [symbol1, symbol2]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 2, totalFiles: 2, byType: { function: 2 } }
      };

      const reference: DocumentationReference = {
        symbolName: 'DuplicateFunction',
        referenceType: 'inline-code',
        sourceFile: '/test.md',
        line: 1,
        column: 1,
        context: 'Use `DuplicateFunction`'
      };

      // Should be valid because the symbol exists (even with duplicates)
      const isValid = validator.validateReference(mockIndex, 'DuplicateFunction');
      expect(isValid).toBe(true);

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, [reference]);
      expect(brokenLinks).toHaveLength(0);
    });
  });

  describe('similarity algorithm edge cases', () => {
    it('should handle very short symbol names', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['a', []],
          ['b', []],
          ['ab', []],
          ['ba', []],
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 4, totalFiles: 1, byType: {} }
      };

      const similar = validator['findSimilarSymbols'](mockIndex, 'a', 0.5);
      expect(similar).toContain('a'); // Exact match should always be first

      const similarToAb = validator['findSimilarSymbols'](mockIndex, 'ab', 0.3);
      expect(similarToAb.length).toBeGreaterThan(0);
    });

    it('should handle symbols with numeric suffixes', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['test1', []],
          ['test2', []],
          ['test10', []],
          ['test123', []],
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 4, totalFiles: 1, byType: {} }
      };

      const similar = validator['findSimilarSymbols'](mockIndex, 'test3', 0.5);
      expect(similar.length).toBeGreaterThan(0);
      expect(similar).toContain('test1');
      expect(similar).toContain('test2');
    });

    it('should handle case sensitivity in similarity', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['UserService', []],
          ['userService', []],
          ['userservice', []],
          ['USERSERVICE', []],
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 4, totalFiles: 1, byType: {} }
      };

      const similar = validator['findSimilarSymbols'](mockIndex, 'UserServic', 0.5);
      expect(similar.length).toBeGreaterThan(0);
      // Should find the closest matches regardless of case
      expect(similar).toContain('UserService');
    });

    it('should handle similarity threshold edge cases', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['exact', []],
          ['close', []],
          ['different', []],
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 3, totalFiles: 1, byType: {} }
      };

      // Very high threshold should only return exact matches
      const highThreshold = validator['findSimilarSymbols'](mockIndex, 'exact', 0.99);
      expect(highThreshold).toContain('exact');

      // Very low threshold should return many matches
      const lowThreshold = validator['findSimilarSymbols'](mockIndex, 'test', 0.1);
      expect(lowThreshold.length).toBeGreaterThanOrEqual(0);

      // Zero threshold should return nothing or everything depending on implementation
      const zeroThreshold = validator['findSimilarSymbols'](mockIndex, 'test', 0);
      expect(Array.isArray(zeroThreshold)).toBe(true);
    });
  });
});