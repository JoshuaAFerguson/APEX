/**
 * Integration Tests for TypeScript/JavaScript Symbol Extractor
 *
 * Tests the complete integration of TypeScriptExtractor with TreeSitterWrapper,
 * file system operations, and complex real-world code scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  TypeScriptExtractor,
  SymbolKind,
  ExtractionError,
  type ExtractedSymbol
} from '../typescript-extractor.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('TypeScriptExtractor Integration', () => {
  let extractor: TypeScriptExtractor;
  let testDir: string;

  beforeEach(async () => {
    TypeScriptExtractor.resetInstance();
    extractor = TypeScriptExtractor.getInstance();
    testDir = await fs.mkdtemp(join(tmpdir(), 'ts-extractor-test-'));
  });

  afterEach(async () => {
    TypeScriptExtractor.resetInstance();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('File Extraction Integration', () => {
    it('should extract symbols from TypeScript file on disk', async () => {
      const tsCode = `
        /**
         * User management service
         */
        export class UserService {
          private users: User[] = [];

          /**
           * Add a new user
           * @param user The user to add
           */
          addUser(user: User): void {
            this.users.push(user);
          }

          getUsers(): User[] {
            return [...this.users];
          }
        }

        export interface User {
          id: string;
          name: string;
          email: string;
        }

        export const DEFAULT_USER_LIMIT = 100;
      `;

      const filePath = join(testDir, 'user-service.ts');
      await fs.writeFile(filePath, tsCode);

      const result = await extractor.extractFromFile(filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.language).toBe(SupportedLanguage.TypeScript);
      expect(result.hasErrors).toBe(false);
      expect(result.symbols).toHaveLength(3);

      // Check specific symbols
      const service = result.symbols.find(s => s.name === 'UserService');
      expect(service).toBeDefined();
      expect(service!.kind).toBe(SymbolKind.Class);
      expect(service!.exportKind).toBe('named');
      expect(service!.documentation).toContain('User management service');
      expect(service!.children).toHaveLength(3); // property + 2 methods

      const interface_ = result.symbols.find(s => s.name === 'User');
      expect(interface_).toBeDefined();
      expect(interface_!.kind).toBe(SymbolKind.Interface);

      const constant = result.symbols.find(s => s.name === 'DEFAULT_USER_LIMIT');
      expect(constant).toBeDefined();
      expect(constant!.kind).toBe(SymbolKind.Constant);
    });

    it('should extract symbols from JavaScript file on disk', async () => {
      const jsCode = `
        /**
         * Simple calculator module
         */
        class Calculator {
          constructor() {
            this.value = 0;
          }

          add(n) {
            this.value += n;
            return this;
          }

          subtract(n) {
            this.value -= n;
            return this;
          }

          get result() {
            return this.value;
          }
        }

        const PI = 3.14159;

        function createCalculator() {
          return new Calculator();
        }

        module.exports = { Calculator, PI, createCalculator };
      `;

      const filePath = join(testDir, 'calculator.js');
      await fs.writeFile(filePath, jsCode);

      const result = await extractor.extractFromFile(filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.language).toBe(SupportedLanguage.JavaScript);
      expect(result.hasErrors).toBe(false);
      expect(result.symbols).toHaveLength(3); // class, const, function

      const calc = result.symbols.find(s => s.name === 'Calculator');
      expect(calc).toBeDefined();
      expect(calc!.kind).toBe(SymbolKind.Class);
      expect(calc!.documentation).toContain('Simple calculator module');
      expect(calc!.children).toHaveLength(4); // constructor + 2 methods + getter
    });

    it('should handle TSX files with React components', async () => {
      const tsxCode = `
        import React from 'react';

        interface ButtonProps {
          label: string;
          onClick: () => void;
          disabled?: boolean;
        }

        /**
         * Reusable button component
         */
        export const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false }) => {
          return (
            <button onClick={onClick} disabled={disabled}>
              {label}
            </button>
          );
        };

        export default Button;
      `;

      const filePath = join(testDir, 'Button.tsx');
      await fs.writeFile(filePath, tsxCode);

      const result = await extractor.extractFromFile(filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.language).toBe(SupportedLanguage.TSX);
      expect(result.hasErrors).toBe(false);
      expect(result.symbols).toHaveLength(2); // interface + arrow function

      const buttonComponent = result.symbols.find(s => s.name === 'Button');
      expect(buttonComponent).toBeDefined();
      expect(buttonComponent!.kind).toBe(SymbolKind.ArrowFunction);
      expect(buttonComponent!.documentation).toContain('Reusable button component');

      const props = result.symbols.find(s => s.name === 'ButtonProps');
      expect(props).toBeDefined();
      expect(props!.kind).toBe(SymbolKind.Interface);
    });

    it('should handle files with syntax errors gracefully', async () => {
      const brokenCode = `
        function validFunction() {
          return "this is fine";
        }

        // This has a syntax error
        function brokenFunction( {
          // missing closing paren and brace
      `;

      const filePath = join(testDir, 'broken.ts');
      await fs.writeFile(filePath, brokenCode);

      const result = await extractor.extractFromFile(filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);

      // Should still extract valid symbols
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
      const validFn = result.symbols.find(s => s.name === 'validFunction');
      expect(validFn).toBeDefined();
    });

    it('should throw error for non-existent files', async () => {
      const nonExistentFile = join(testDir, 'does-not-exist.ts');

      await expect(
        extractor.extractFromFile(nonExistentFile)
      ).rejects.toThrow(ExtractionError);
    });

    it('should throw error for unsupported file extensions', async () => {
      const pythonCode = 'def hello(): pass';
      const pythonFile = join(testDir, 'hello.py');
      await fs.writeFile(pythonFile, pythonCode);

      await expect(
        extractor.extractFromFile(pythonFile)
      ).rejects.toThrow(ExtractionError);
    });
  });

  describe('Complex Code Scenarios', () => {
    it('should handle deeply nested class hierarchies', async () => {
      const complexCode = `
        namespace MyNamespace {
          export abstract class BaseEntity {
            protected abstract id: string;

            abstract save(): Promise<void>;
          }

          export class User extends BaseEntity {
            protected id: string;
            private name: string;

            constructor(id: string, name: string) {
              super();
              this.id = id;
              this.name = name;
            }

            async save(): Promise<void> {
              // Implementation
            }

            static fromJSON(data: any): User {
              return new User(data.id, data.name);
            }

            get displayName(): string {
              return this.name;
            }
          }

          export interface Repository<T> {
            findById(id: string): Promise<T | null>;
            save(entity: T): Promise<void>;
          }

          export class UserRepository implements Repository<User> {
            async findById(id: string): Promise<User | null> {
              // Implementation
              return null;
            }

            async save(user: User): Promise<void> {
              await user.save();
            }
          }
        }
      `;

      const result = await extractor.extract(complexCode, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(false);
      expect(result.symbols.length).toBeGreaterThan(0);

      // Find the classes and verify their structure
      const symbols = result.symbols;
      const baseEntity = findSymbolByName(symbols, 'BaseEntity');
      const user = findSymbolByName(symbols, 'User');
      const repository = findSymbolByName(symbols, 'Repository');
      const userRepository = findSymbolByName(symbols, 'UserRepository');

      expect(baseEntity).toBeDefined();
      expect(baseEntity!.modifiers).toContain('abstract');

      expect(user).toBeDefined();
      expect(user!.children!.length).toBeGreaterThan(3); // properties, constructor, methods

      expect(repository).toBeDefined();
      expect(repository!.kind).toBe(SymbolKind.Interface);

      expect(userRepository).toBeDefined();
      expect(userRepository!.kind).toBe(SymbolKind.Class);
    });

    it('should extract symbols from module with complex exports', async () => {
      const moduleCode = `
        // Named exports
        export const VERSION = '1.0.0';
        export let debugMode = false;

        export function createLogger(name: string) {
          return {
            log: (msg: string) => console.log(msg)
          };
        }

        export class Logger {
          private name: string;

          constructor(name: string) {
            this.name = name;
          }

          log(message: string): void {
            console.log(\`[\${this.name}] \${message}\`);
          }
        }

        // Default export
        export default class Application {
          private logger: Logger;

          constructor() {
            this.logger = new Logger('app');
          }

          run(): void {
            this.logger.log('Application started');
          }
        }

        // Type exports
        export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
        export interface Config {
          logLevel: LogLevel;
          debug: boolean;
        }

        // Enum export
        export enum Status {
          Starting = 'starting',
          Running = 'running',
          Stopped = 'stopped'
        }
      `;

      const result = await extractor.extract(moduleCode, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(false);
      expect(result.symbols.length).toBe(8); // VERSION, debugMode, createLogger, Logger, Application, LogLevel, Config, Status

      // Check export kinds
      const defaultExport = result.symbols.find(s => s.exportKind === 'default');
      expect(defaultExport).toBeDefined();
      expect(defaultExport!.name).toBe('Application');

      const namedExports = result.symbols.filter(s => s.exportKind === 'named');
      expect(namedExports.length).toBe(7);

      // Check specific symbol types
      const constant = result.symbols.find(s => s.name === 'VERSION');
      expect(constant!.kind).toBe(SymbolKind.Constant);
      expect(constant!.modifiers).toContain('const');

      const variable = result.symbols.find(s => s.name === 'debugMode');
      expect(variable!.kind).toBe(SymbolKind.Variable);
      expect(variable!.modifiers).toContain('let');

      const typeAlias = result.symbols.find(s => s.name === 'LogLevel');
      expect(typeAlias!.kind).toBe(SymbolKind.TypeAlias);

      const interface_ = result.symbols.find(s => s.name === 'Config');
      expect(interface_!.kind).toBe(SymbolKind.Interface);

      const enum_ = result.symbols.find(s => s.name === 'Status');
      expect(enum_!.kind).toBe(SymbolKind.Enum);
      expect(enum_!.children!.length).toBe(3);
    });

    it('should handle generic types and decorators', async () => {
      const genericCode = `
        // Generic class
        export class Container<T> {
          private items: T[] = [];

          add(item: T): void {
            this.items.push(item);
          }

          getAll(): T[] {
            return [...this.items];
          }

          find(predicate: (item: T) => boolean): T | undefined {
            return this.items.find(predicate);
          }
        }

        // Generic interface
        export interface Mapper<TInput, TOutput> {
          map(input: TInput): TOutput;
        }

        // Generic type alias
        export type Result<T, E = Error> =
          | { success: true; data: T }
          | { success: false; error: E };

        // Generic function
        export function identity<T>(value: T): T {
          return value;
        }

        // Utility types
        export type Partial<T> = {
          [P in keyof T]?: T[P];
        };
      `;

      const result = await extractor.extract(genericCode, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(false);
      expect(result.symbols.length).toBe(5);

      const container = result.symbols.find(s => s.name === 'Container');
      expect(container).toBeDefined();
      expect(container!.kind).toBe(SymbolKind.Class);
      expect(container!.children!.length).toBe(4); // property + 3 methods

      const mapper = result.symbols.find(s => s.name === 'Mapper');
      expect(mapper).toBeDefined();
      expect(mapper!.kind).toBe(SymbolKind.Interface);

      const resultType = result.symbols.find(s => s.name === 'Result');
      expect(resultType).toBeDefined();
      expect(resultType!.kind).toBe(SymbolKind.TypeAlias);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large files efficiently', async () => {
      // Generate a large file with many symbols
      const generateLargeCode = (numClasses: number) => {
        let code = '';
        for (let i = 0; i < numClasses; i++) {
          code += `
            export class Class${i} {
              private value${i}: number = ${i};

              method${i}(): number {
                return this.value${i};
              }

              static staticMethod${i}(): string {
                return "Class${i}";
              }
            }
          `;
        }
        return code;
      };

      const largeCode = generateLargeCode(50); // 50 classes with methods
      const filePath = join(testDir, 'large-file.ts');
      await fs.writeFile(filePath, largeCode);

      const startTime = performance.now();
      const result = await extractor.extractFromFile(filePath);
      const endTime = performance.now();

      expect(result.symbols.length).toBe(50);
      expect(result.hasErrors).toBe(false);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Each class should have 2 methods
      result.symbols.forEach((symbol, index) => {
        expect(symbol.name).toBe(`Class${index}`);
        expect(symbol.kind).toBe(SymbolKind.Class);
        expect(symbol.children!.length).toBe(3); // property + method + static method
      });
    });
  });

  describe('TreeSitterWrapper Integration', () => {
    it('should use cached parsers for better performance', async () => {
      const code = 'function test() {}';

      // First extraction - should initialize parser
      const result1 = await extractor.extract(code, SupportedLanguage.TypeScript);
      expect(result1.symbols.length).toBe(1);

      // Second extraction - should use cached parser
      const result2 = await extractor.extract(code, SupportedLanguage.TypeScript);
      expect(result2.symbols.length).toBe(1);

      // Results should be equivalent but not the same object
      expect(result1).not.toBe(result2);
      expect(result1.symbols[0].name).toBe(result2.symbols[0].name);
    });
  });
});

// Helper function to find symbol by name in nested structure
function findSymbolByName(symbols: ExtractedSymbol[], name: string): ExtractedSymbol | undefined {
  for (const symbol of symbols) {
    if (symbol.name === name) {
      return symbol;
    }
    if (symbol.children) {
      const found = findSymbolByName(symbol.children, name);
      if (found) return found;
    }
  }
  return undefined;
}