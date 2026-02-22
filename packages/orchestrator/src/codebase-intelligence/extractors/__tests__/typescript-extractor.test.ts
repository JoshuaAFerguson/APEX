/**
 * Unit Tests for TypeScript/JavaScript Symbol Extractor
 *
 * Tests the TypeScriptExtractor class functionality including:
 * - Function extraction
 * - Class extraction
 * - Interface extraction (TypeScript)
 * - Type alias extraction (TypeScript)
 * - Enum extraction (TypeScript)
 * - Variable/constant extraction
 * - Export handling
 * - Documentation extraction
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TypeScriptExtractor,
  getTypeScriptExtractor,
  SymbolKind,
  ExtractionError,
  type ExtractedSymbol,
  type ExtractionResult,
  type ExtractionOptions
} from './typescript-extractor.js';
import { SupportedLanguage } from '../parsers/types.js';

describe('TypeScriptExtractor', () => {
  let extractor: TypeScriptExtractor;

  beforeEach(() => {
    TypeScriptExtractor.resetInstance();
    extractor = TypeScriptExtractor.getInstance();
  });

  afterEach(() => {
    TypeScriptExtractor.resetInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = TypeScriptExtractor.getInstance();
      const instance2 = TypeScriptExtractor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return same instance through convenience function', () => {
      const instance1 = TypeScriptExtractor.getInstance();
      const instance2 = getTypeScriptExtractor();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Language Support', () => {
    it('should support TypeScript', async () => {
      const code = 'function hello(): string { return "hello"; }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);
      expect(result.language).toBe(SupportedLanguage.TypeScript);
      expect(result.symbols).toHaveLength(1);
    });

    it('should support TSX', async () => {
      const code = 'function Component() { return <div>Hello</div>; }';
      const result = await extractor.extract(code, SupportedLanguage.TSX);
      expect(result.language).toBe(SupportedLanguage.TSX);
      expect(result.symbols).toHaveLength(1);
    });

    it('should support JavaScript', async () => {
      const code = 'function hello() { return "hello"; }';
      const result = await extractor.extract(code, SupportedLanguage.JavaScript);
      expect(result.language).toBe(SupportedLanguage.JavaScript);
      expect(result.symbols).toHaveLength(1);
    });

    it('should reject unsupported languages', async () => {
      const code = 'def hello(): return "hello"';
      await expect(
        extractor.extract(code, SupportedLanguage.Python)
      ).rejects.toThrow(ExtractionError);
    });
  });

  describe('Function Extraction', () => {
    it('should extract function declaration', async () => {
      const code = 'function greet(name: string): string { return `Hello, ${name}!`; }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.name).toBe('greet');
      expect(fn.kind).toBe(SymbolKind.Function);
      expect(fn.exportKind).toBe('none');
      expect(fn.modifiers).toEqual([]);
    });

    it('should extract generator function', async () => {
      const code = 'function* numbers() { yield 1; yield 2; }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.name).toBe('numbers');
      expect(fn.kind).toBe(SymbolKind.Function);
      expect(fn.modifiers).toContain('generator');
    });

    it('should extract async function', async () => {
      const code = 'async function fetchData(): Promise<string> { return "data"; }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.name).toBe('fetchData');
      expect(fn.kind).toBe(SymbolKind.Function);
      expect(fn.modifiers).toContain('async');
    });

    it('should extract arrow function assigned to const', async () => {
      const code = 'const arrow = (x: number) => x * 2;';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.name).toBe('arrow');
      expect(fn.kind).toBe(SymbolKind.ArrowFunction);
      expect(fn.modifiers).toContain('const');
    });

    it('should include function signatures when requested', async () => {
      const code = 'function add(a: number, b: number): number { return a + b; }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        includeSignatures: true
      });

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.signature).toContain('a: number, b: number');
      expect(fn.typeAnnotation).toContain('number');
    });
  });

  describe('Class Extraction', () => {
    it('should extract class declaration', async () => {
      const code = `
        class Calculator {
          private value: number = 0;

          add(n: number): void {
            this.value += n;
          }

          get result(): number {
            return this.value;
          }
        }
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const cls = result.symbols[0];
      expect(cls.name).toBe('Calculator');
      expect(cls.kind).toBe(SymbolKind.Class);
      expect(cls.children).toHaveLength(3); // property, method, getter
    });

    it('should extract class methods with correct kinds', async () => {
      const code = `
        class Example {
          constructor(private x: number) {}

          get value(): number { return this.x; }

          set value(v: number) { this.x = v; }

          doSomething(): void {}
        }
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      const cls = result.symbols[0];
      expect(cls.children).toHaveLength(4);

      const constructor = cls.children!.find(m => m.kind === SymbolKind.Constructor);
      expect(constructor).toBeDefined();
      expect(constructor!.name).toBe('constructor');

      const getter = cls.children!.find(m => m.kind === SymbolKind.Getter);
      expect(getter).toBeDefined();
      expect(getter!.name).toBe('value');

      const setter = cls.children!.find(m => m.kind === SymbolKind.Setter);
      expect(setter).toBeDefined();
      expect(setter!.name).toBe('value');

      const method = cls.children!.find(m => m.kind === SymbolKind.Method && m.name === 'doSomething');
      expect(method).toBeDefined();
    });

    it('should handle class modifiers', async () => {
      const code = 'abstract class BaseComponent { abstract render(): void; }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      const cls = result.symbols[0];
      expect(cls.modifiers).toContain('abstract');
    });

    it('should filter private members when requested', async () => {
      const code = `
        class Example {
          public publicProp = 1;
          private privateProp = 2;
          #modernPrivate = 3;

          public publicMethod() {}
          private privateMethod() {}
        }
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        includePrivate: false
      });

      const cls = result.symbols[0];
      expect(cls.children).toHaveLength(2); // Only public members
      expect(cls.children!.every(m => !m.modifiers.includes('private'))).toBe(true);
      expect(cls.children!.every(m => !m.name.startsWith('#'))).toBe(true);
    });
  });

  describe('TypeScript-specific Extractions', () => {
    it('should extract interface declarations', async () => {
      const code = `
        interface User {
          name: string;
          age: number;
          isActive(): boolean;
        }
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const iface = result.symbols[0];
      expect(iface.name).toBe('User');
      expect(iface.kind).toBe(SymbolKind.Interface);
      expect(iface.children).toHaveLength(3); // 2 properties, 1 method
    });

    it('should extract type alias declarations', async () => {
      const code = 'type Status = "pending" | "completed" | "failed";';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const type = result.symbols[0];
      expect(type.name).toBe('Status');
      expect(type.kind).toBe(SymbolKind.TypeAlias);
    });

    it('should extract enum declarations', async () => {
      const code = `
        enum Color {
          Red,
          Green = "green",
          Blue = 2
        }
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const enumSymbol = result.symbols[0];
      expect(enumSymbol.name).toBe('Color');
      expect(enumSymbol.kind).toBe(SymbolKind.Enum);
      expect(enumSymbol.children).toHaveLength(3);
      expect(enumSymbol.children!.every(m => m.kind === SymbolKind.EnumMember)).toBe(true);
    });
  });

  describe('Variable and Constant Extraction', () => {
    it('should extract const declarations as constants', async () => {
      const code = 'const API_URL = "https://api.example.com";';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const constant = result.symbols[0];
      expect(constant.name).toBe('API_URL');
      expect(constant.kind).toBe(SymbolKind.Constant);
      expect(constant.modifiers).toContain('const');
    });

    it('should extract let declarations as variables', async () => {
      const code = 'let counter = 0;';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const variable = result.symbols[0];
      expect(variable.name).toBe('counter');
      expect(variable.kind).toBe(SymbolKind.Variable);
      expect(variable.modifiers).toContain('let');
    });

    it('should extract var declarations as variables', async () => {
      const code = 'var oldStyle = true;';
      const result = await extractor.extract(code, SupportedLanguage.JavaScript);

      expect(result.symbols).toHaveLength(1);
      const variable = result.symbols[0];
      expect(variable.name).toBe('oldStyle');
      expect(variable.kind).toBe(SymbolKind.Variable);
      expect(variable.modifiers).toContain('var');
    });
  });

  describe('Export Handling', () => {
    it('should extract named exports', async () => {
      const code = 'export function helper() {}';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.exportKind).toBe('named');
      expect(fn.modifiers).toContain('export');
    });

    it('should extract default exports', async () => {
      const code = 'export default function main() {}';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.exportKind).toBe('default');
      expect(fn.modifiers).toContain('export');
      expect(fn.modifiers).toContain('default');
    });

    it('should extract exported classes', async () => {
      const code = 'export class Component { render() {} }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);
      const cls = result.symbols[0];
      expect(cls.exportKind).toBe('named');
      expect(cls.modifiers).toContain('export');
    });
  });

  describe('Documentation Extraction', () => {
    it('should extract JSDoc comments when enabled', async () => {
      const code = `
        /**
         * Calculates the sum of two numbers
         * @param a First number
         * @param b Second number
         * @returns The sum of a and b
         */
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        includeDocumentation: true
      });

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.documentation).toBeDefined();
      expect(fn.documentation).toContain('Calculates the sum of two numbers');
      expect(fn.documentation).toContain('@param a First number');
    });

    it('should not extract documentation when disabled', async () => {
      const code = `
        /** This is a documented function */
        function test() {}
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        includeDocumentation: false
      });

      expect(result.symbols).toHaveLength(1);
      const fn = result.symbols[0];
      expect(fn.documentation).toBeUndefined();
    });
  });

  describe('Extraction Options', () => {
    it('should filter by symbol kinds', async () => {
      const code = `
        function fn() {}
        class Cls {}
        const CONST = 1;
      `;
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        symbolKinds: [SymbolKind.Function]
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].kind).toBe(SymbolKind.Function);
    });

    it('should respect maxDepth option', async () => {
      const code = `
        class Example {
          method() {
            // Would have nested symbols if we went deeper
          }
        }
      `;

      // Test maxDepth = 0 (no children)
      const resultNoChildren = await extractor.extract(code, SupportedLanguage.TypeScript, {
        maxDepth: 0
      });
      expect(resultNoChildren.symbols[0].children).toBeUndefined();

      // Test maxDepth = 1 (include direct children)
      const resultWithChildren = await extractor.extract(code, SupportedLanguage.TypeScript, {
        maxDepth: 1
      });
      expect(resultWithChildren.symbols[0].children).toHaveLength(1);
    });

    it('should include signatures when requested', async () => {
      const code = 'function test(x: string): number { return 0; }';

      const withSignatures = await extractor.extract(code, SupportedLanguage.TypeScript, {
        includeSignatures: true
      });
      expect(withSignatures.symbols[0].signature).toBeDefined();
      expect(withSignatures.symbols[0].typeAnnotation).toBeDefined();

      const withoutSignatures = await extractor.extract(code, SupportedLanguage.TypeScript, {
        includeSignatures: false
      });
      expect(withoutSignatures.symbols[0].signature).toBeUndefined();
      expect(withoutSignatures.symbols[0].typeAnnotation).toBeUndefined();
    });
  });

  describe('File Extraction', () => {
    it('should handle extraction errors gracefully', async () => {
      await expect(
        extractor.extractFromFile('/nonexistent/file.ts')
      ).rejects.toThrow(ExtractionError);
    });
  });

  describe('Performance and Metadata', () => {
    it('should include extraction timing', async () => {
      const code = 'function test() {}';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.extractionTimeMs).toBe('number');
    });

    it('should report parse errors', async () => {
      const code = 'function broken( { /* syntax error */ }';
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty source code', async () => {
      const result = await extractor.extract('', SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(0);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should extract from complex TypeScript file', async () => {
      const code = `
        /**
         * User service for managing user data
         */
        export interface IUserService {
          getUser(id: string): Promise<User>;
          updateUser(user: User): Promise<void>;
        }

        export type UserRole = 'admin' | 'user' | 'guest';

        export enum UserStatus {
          Active = 'active',
          Inactive = 'inactive',
          Pending = 'pending'
        }

        export class UserService implements IUserService {
          private readonly apiUrl: string;

          constructor(apiUrl: string) {
            this.apiUrl = apiUrl;
          }

          async getUser(id: string): Promise<User> {
            // Implementation
            throw new Error('Not implemented');
          }

          async updateUser(user: User): Promise<void> {
            // Implementation
          }

          private validateUser(user: User): boolean {
            return user.id.length > 0;
          }
        }

        export const DEFAULT_USER_ROLE: UserRole = 'user';

        export default UserService;
      `;

      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      // Should extract all top-level symbols
      expect(result.symbols.length).toBeGreaterThanOrEqual(5);

      // Check specific symbols
      const iface = result.symbols.find(s => s.kind === SymbolKind.Interface);
      expect(iface).toBeDefined();
      expect(iface!.name).toBe('IUserService');
      expect(iface!.exportKind).toBe('named');

      const typeAlias = result.symbols.find(s => s.kind === SymbolKind.TypeAlias);
      expect(typeAlias).toBeDefined();
      expect(typeAlias!.name).toBe('UserRole');

      const enumSymbol = result.symbols.find(s => s.kind === SymbolKind.Enum);
      expect(enumSymbol).toBeDefined();
      expect(enumSymbol!.name).toBe('UserStatus');

      const cls = result.symbols.find(s => s.kind === SymbolKind.Class);
      expect(cls).toBeDefined();
      expect(cls!.name).toBe('UserService');
      expect(cls!.children!.length).toBeGreaterThan(2);

      const constant = result.symbols.find(s => s.kind === SymbolKind.Constant);
      expect(constant).toBeDefined();
      expect(constant!.name).toBe('DEFAULT_USER_ROLE');
    });

    it('should handle JSX in TSX files', async () => {
      const code = `
        interface Props {
          name: string;
          age?: number;
        }

        const Component: React.FC<Props> = ({ name, age }) => {
          return <div>Hello {name}, age: {age}</div>;
        };

        export default Component;
      `;

      const result = await extractor.extract(code, SupportedLanguage.TSX);

      expect(result.symbols).toHaveLength(2); // interface + arrow function
      expect(result.hasErrors).toBe(false);

      const iface = result.symbols.find(s => s.kind === SymbolKind.Interface);
      expect(iface!.name).toBe('Props');

      const component = result.symbols.find(s => s.kind === SymbolKind.ArrowFunction);
      expect(component!.name).toBe('Component');
    });
  });
});