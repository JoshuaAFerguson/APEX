/**
 * Tests for CrossReferenceValidator
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  CrossReferenceValidator,
  type SymbolInfo,
  type SymbolIndex,
  type DocumentationReference
} from './cross-reference-validator';

describe('CrossReferenceValidator', () => {
  let validator: CrossReferenceValidator;
  let tempDir: string;

  beforeEach(async () => {
    validator = new CrossReferenceValidator();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cross-ref-validator-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('extractSymbols', () => {
    test('should extract exported functions', () => {
      const content = `
export function hello() {
  return 'world';
}

export async function fetchData() {
  return data;
}
`;

      const symbols = validator.extractSymbols('test.ts', content);

      expect(symbols).toHaveLength(2);
      expect(symbols[0]).toEqual({
        name: 'hello',
        type: 'function',
        file: 'test.ts',
        line: 2,
        column: 1,
        isExported: true,
        documentation: undefined,
      });

      expect(symbols[1]).toEqual({
        name: 'fetchData',
        type: 'function',
        file: 'test.ts',
        line: 6,
        column: 1,
        isExported: true,
        documentation: undefined,
      });
    });

    test('should extract non-exported functions', () => {
      const content = `
function helper() {
  return true;
}

async function processAsync() {
  return process();
}
`;

      const symbols = validator.extractSymbols('test.ts', content, true); // includePrivate = true

      expect(symbols).toHaveLength(2);
      expect(symbols[0]).toEqual({
        name: 'helper',
        type: 'function',
        file: 'test.ts',
        line: 2,
        column: 1,
        isExported: false,
        documentation: undefined,
      });

      expect(symbols[1]).toEqual({
        name: 'processAsync',
        type: 'function',
        file: 'test.ts',
        line: 6,
        column: 1,
        isExported: false,
        documentation: undefined,
      });
    });

    test('should extract arrow functions', () => {
      const content = `
export const add = (a, b) => a + b;
const subtract = (a, b) => a - b;
export const multiply = async (a, b) => {
  return a * b;
};
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      expect(symbols).toHaveLength(3);
      expect(symbols[0].name).toBe('add');
      expect(symbols[0].isExported).toBe(true);
      expect(symbols[1].name).toBe('subtract');
      expect(symbols[1].isExported).toBe(false);
      expect(symbols[2].name).toBe('multiply');
      expect(symbols[2].isExported).toBe(true);
    });

    test('should extract classes', () => {
      const content = `
export class User {
  name: string;
}

abstract class BaseEntity {
  id: number;
}

export abstract class Repository {
  abstract save(entity: any): void;
}
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      const classes = symbols.filter(s => s.type === 'class');
      expect(classes).toHaveLength(3);

      expect(classes[0]).toEqual({
        name: 'User',
        type: 'class',
        file: 'test.ts',
        line: 2,
        column: 1,
        isExported: true,
        documentation: undefined,
      });

      expect(classes[1]).toEqual({
        name: 'BaseEntity',
        type: 'class',
        file: 'test.ts',
        line: 6,
        column: 1,
        isExported: false,
        documentation: undefined,
      });

      expect(classes[2]).toEqual({
        name: 'Repository',
        type: 'class',
        file: 'test.ts',
        line: 10,
        column: 1,
        isExported: true,
        documentation: undefined,
      });
    });

    test('should extract interfaces and types', () => {
      const content = `
export interface Config {
  apiUrl: string;
}

interface InternalOptions {
  debug: boolean;
}

export type UserId = string;

type Status = 'pending' | 'complete';
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      const interfaces = symbols.filter(s => s.type === 'interface');
      const types = symbols.filter(s => s.type === 'type');

      expect(interfaces).toHaveLength(2);
      expect(types).toHaveLength(2);

      expect(interfaces[0].name).toBe('Config');
      expect(interfaces[0].isExported).toBe(true);
      expect(interfaces[1].name).toBe('InternalOptions');
      expect(interfaces[1].isExported).toBe(false);

      expect(types[0].name).toBe('UserId');
      expect(types[0].isExported).toBe(true);
      expect(types[1].name).toBe('Status');
      expect(types[1].isExported).toBe(false);
    });

    test('should extract enums', () => {
      const content = `
export enum Color {
  RED = 'red',
  GREEN = 'green',
  BLUE = 'blue'
}

enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT
}
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      const enums = symbols.filter(s => s.type === 'enum');
      expect(enums).toHaveLength(2);

      expect(enums[0].name).toBe('Color');
      expect(enums[0].isExported).toBe(true);
      expect(enums[1].name).toBe('Direction');
      expect(enums[1].isExported).toBe(false);
    });

    test('should extract constants and variables', () => {
      const content = `
export const API_URL = 'https://api.example.com';
const VERSION = '1.0.0';
let counter = 0;
export let globalConfig = {};
var legacy = true;
export var exportedLegacy = false;
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      const constants = symbols.filter(s => s.type === 'const');
      const variables = symbols.filter(s => s.type === 'variable');

      expect(constants).toHaveLength(2);
      expect(variables).toHaveLength(4);

      expect(constants[0].name).toBe('API_URL');
      expect(constants[0].isExported).toBe(true);
      expect(constants[1].name).toBe('VERSION');
      expect(constants[1].isExported).toBe(false);
    });

    test('should extract class methods and properties', () => {
      const content = `
export class Calculator {
  private value: number = 0;
  public result: number;

  public add(num: number): void {
    this.value += num;
  }

  private multiply(factor: number): number {
    return this.value * factor;
  }

  static create(): Calculator {
    return new Calculator();
  }

  async processAsync(): Promise<void> {
    // process
  }
}
`;

      const symbols = validator.extractSymbols('test.ts', content, true, true); // includePrivate = true, includeMembers = true

      const methods = symbols.filter(s => s.type === 'method');
      const properties = symbols.filter(s => s.type === 'property');
      const classes = symbols.filter(s => s.type === 'class');

      expect(classes).toHaveLength(1);
      expect(properties).toHaveLength(2);
      expect(methods).toHaveLength(4);

      // Check class
      expect(classes[0].name).toBe('Calculator');

      // Check properties
      expect(properties[0].name).toBe('value');
      expect(properties[0].parent).toBe('Calculator');
      expect(properties[1].name).toBe('result');
      expect(properties[1].parent).toBe('Calculator');

      // Check methods
      expect(methods[0].name).toBe('add');
      expect(methods[0].parent).toBe('Calculator');
      expect(methods[1].name).toBe('multiply');
      expect(methods[1].parent).toBe('Calculator');
      expect(methods[2].name).toBe('create');
      expect(methods[2].parent).toBe('Calculator');
      expect(methods[3].name).toBe('processAsync');
      expect(methods[3].parent).toBe('Calculator');
    });

    test('should extract JSDoc documentation', () => {
      const content = `
/**
 * Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @returns The sum
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * User configuration interface
 */
export interface UserConfig {
  name: string;
}
`;

      const symbols = validator.extractSymbols('test.ts', content);

      expect(symbols).toHaveLength(2);
      expect(symbols[0].documentation).toBe('Calculates the sum of two numbers @param a First number @param b Second number @returns The sum');
      expect(symbols[1].documentation).toBe('User configuration interface');
    });

    test('should handle edge cases', () => {
      const content = `
// Comment line
/* Block comment */

export function validFunction() {}

// This should be ignored
function // invalid syntax

export class ValidClass {
  // comment inside class
}

// Empty lines and whitespace


export const VALID_CONST = 'value';
`;

      const symbols = validator.extractSymbols('test.ts', content);

      // Should only extract valid symbols
      expect(symbols).toHaveLength(3);
      expect(symbols[0].name).toBe('validFunction');
      expect(symbols[1].name).toBe('ValidClass');
      expect(symbols[2].name).toBe('VALID_CONST');
    });
  });

  describe('buildIndex', () => {
    test('should build symbol index from directory', async () => {
      // Create test files
      const file1Content = `
export function processData() {}
export class DataProcessor {}
`;

      const file2Content = `
export interface Config {}
export type Status = 'ok' | 'error';
const helper = () => {};
`;

      await fs.writeFile(path.join(tempDir, 'file1.ts'), file1Content);
      await fs.writeFile(path.join(tempDir, 'file2.ts'), file2Content);

      const index = await validator.buildIndex(tempDir);

      expect(index.stats.totalFiles).toBe(2);
      expect(index.stats.totalSymbols).toBe(4); // Only exported symbols by default
      expect(index.stats.byType.function).toBe(1);
      expect(index.stats.byType.class).toBe(1);
      expect(index.stats.byType.interface).toBe(1);
      expect(index.stats.byType.type).toBe(1);

      // Check byName index
      expect(index.byName.has('processData')).toBe(true);
      expect(index.byName.has('DataProcessor')).toBe(true);
      expect(index.byName.has('Config')).toBe(true);
      expect(index.byName.has('Status')).toBe(true);
      expect(index.byName.has('helper')).toBe(false); // Not exported

      // Check byFile index
      const file1Path = path.join(tempDir, 'file1.ts');
      const file2Path = path.join(tempDir, 'file2.ts');
      expect(index.byFile.has(file1Path)).toBe(true);
      expect(index.byFile.has(file2Path)).toBe(true);
      expect(index.byFile.get(file1Path)).toHaveLength(2);
      expect(index.byFile.get(file2Path)).toHaveLength(2);
    });

    test('should respect file extension filters', async () => {
      await fs.writeFile(path.join(tempDir, 'script.ts'), 'export function typescript() {}');
      await fs.writeFile(path.join(tempDir, 'script.js'), 'export function javascript() {}');
      await fs.writeFile(path.join(tempDir, 'data.json'), '{"key": "value"}');
      await fs.writeFile(path.join(tempDir, 'readme.md'), '# Title');

      const index = await validator.buildIndex(tempDir, {
        extensions: ['.ts', '.js'],
      });

      expect(index.stats.totalFiles).toBe(2);
      expect(index.byName.has('typescript')).toBe(true);
      expect(index.byName.has('javascript')).toBe(true);
    });

    test('should respect include/exclude patterns', async () => {
      // Create directory structure
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.mkdir(path.join(tempDir, 'dist'));

      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'export function main() {}');
      await fs.writeFile(path.join(tempDir, 'node_modules', 'lib.ts'), 'export function lib() {}');
      await fs.writeFile(path.join(tempDir, 'dist', 'output.ts'), 'export function output() {}');

      const index = await validator.buildIndex(tempDir, {
        include: ['src/**/*'],
        exclude: ['node_modules/**', 'dist/**'],
      });

      expect(index.stats.totalFiles).toBe(1);
      expect(index.byName.has('main')).toBe(true);
      expect(index.byName.has('lib')).toBe(false);
      expect(index.byName.has('output')).toBe(false);
    });

    test('should include private symbols when requested', async () => {
      const content = `
export function exported() {}
function notExported() {}
const helper = () => {};
`;

      await fs.writeFile(path.join(tempDir, 'test.ts'), content);

      const index = await validator.buildIndex(tempDir, {
        includePrivate: true,
      });

      expect(index.stats.totalSymbols).toBe(3);
      expect(index.byName.has('exported')).toBe(true);
      expect(index.byName.has('notExported')).toBe(true);
      expect(index.byName.has('helper')).toBe(true);
    });
  });

  describe('lookup and validation methods', () => {
    let index: SymbolIndex;

    beforeEach(async () => {
      const content = `
export function processData() {}
export class DataProcessor {}
function helper() {}
`;

      await fs.writeFile(path.join(tempDir, 'test.ts'), content);
      index = await validator.buildIndex(tempDir, { includePrivate: true });
    });

    test('should lookup symbols by name', () => {
      const symbols = validator.lookupSymbol(index, 'processData');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('processData');
      expect(symbols[0].type).toBe('function');

      const notFound = validator.lookupSymbol(index, 'nonexistent');
      expect(notFound).toHaveLength(0);
    });

    test('should get symbols from specific file', () => {
      const filePath = path.join(tempDir, 'test.ts');
      const symbols = validator.getFileSymbols(index, filePath);

      expect(symbols).toHaveLength(3);
      expect(symbols.map(s => s.name)).toEqual(['processData', 'DataProcessor', 'helper']);
    });

    test('should validate symbol references', () => {
      expect(validator.validateReference(index, 'processData')).toBe(true);
      expect(validator.validateReference(index, 'DataProcessor')).toBe(true);
      expect(validator.validateReference(index, 'helper')).toBe(true);
      expect(validator.validateReference(index, 'nonexistent')).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle non-existent directory gracefully', async () => {
      const index = await validator.buildIndex('/nonexistent/path');

      expect(index.stats.totalFiles).toBe(0);
      expect(index.stats.totalSymbols).toBe(0);
      expect(index.byName.size).toBe(0);
      expect(index.byFile.size).toBe(0);
    });

    test('should handle malformed source code', () => {
      const malformedContent = `
export function incomplete(
// Missing closing bracket and other syntax errors
class {
  unclosed method() {
`;

      // Should not throw, just return what it can parse
      const symbols = validator.extractSymbols('test.ts', malformedContent);

      // May extract some symbols despite syntax errors
      expect(Array.isArray(symbols)).toBe(true);
    });

    test('should handle permission errors when reading files', async () => {
      // Create a file and then try to access a protected directory
      const protectedDir = path.join(tempDir, 'protected');
      await fs.mkdir(protectedDir);

      // This should complete without throwing, even if some files can't be read
      const index = await validator.buildIndex(tempDir);
      expect(index).toBeDefined();
    });
  });
});

describe('Integration tests', () => {
  let validator: CrossReferenceValidator;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
  });

  test('should handle complex real-world TypeScript file', () => {
    const content = `
/**
 * User service for managing user data
 */
export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    // implementation
    return {} as User;
  }

  private validateUser(user: User): boolean {
    return true;
  }
}

/**
 * User interface
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Request for creating a user
 */
export type CreateUserRequest = Omit<User, 'id'>;

/**
 * User status enum
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

/**
 * Configuration constants
 */
export const CONFIG = {
  MAX_USERS: 1000,
  DEFAULT_STATUS: UserStatus.ACTIVE
};

/**
 * Utility function
 */
export function formatUserName(user: User): string {
  return \`\${user.name} (\${user.email})\`;
}

// Private helper
function isValidEmail(email: string): boolean {
  return email.includes('@');
}
`;

    const symbols = validator.extractSymbols('user-service.ts', content, true, true);

    // Should extract all symbols including class members
    const symbolsByType = symbols.reduce((acc, symbol) => {
      acc[symbol.type] = (acc[symbol.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(symbolsByType.class).toBe(1); // UserService
    expect(symbolsByType.interface).toBe(1); // User
    expect(symbolsByType.type).toBe(1); // CreateUserRequest
    expect(symbolsByType.enum).toBe(1); // UserStatus
    expect(symbolsByType.const).toBe(1); // CONFIG
    expect(symbolsByType.function).toBe(2); // formatUserName, isValidEmail
    expect(symbolsByType.method).toBe(2); // createUser, validateUser
    expect(symbolsByType.property).toBe(1); // users

    // Check documentation extraction
    const userService = symbols.find(s => s.name === 'UserService');
    expect(userService?.documentation).toContain('User service for managing user data');

    const createUser = symbols.find(s => s.name === 'createUser');
    expect(createUser?.documentation).toContain('Create a new user');
    expect(createUser?.parent).toBe('UserService');
  });
});

describe('Additional Edge Cases and Coverage Tests', () => {
  let validator: CrossReferenceValidator;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
  });

  describe('regex pattern edge cases', () => {
    test('should handle functions with special characters in names', () => {
      const content = `
export function $specialFunction() {}
export function _underscoreFunction() {}
export function camelCaseFunction() {}
export function PascalCaseFunction() {}
export function function123() {}
`;

      const symbols = validator.extractSymbols('test.ts', content);

      expect(symbols).toHaveLength(5);
      expect(symbols.map(s => s.name)).toEqual([
        '$specialFunction',
        '_underscoreFunction',
        'camelCaseFunction',
        'PascalCaseFunction',
        'function123'
      ]);
    });

    test('should handle nested class structures correctly', () => {
      const content = `
export class OuterClass {
  innerProperty: string;

  innerMethod() {}

  static staticMethod() {}
}

class AnotherClass {
  public publicProp: number = 0;
  private privateProp: boolean;
  protected protectedProp?: string;

  constructor() {}

  async asyncMethod(): Promise<void> {}
}
`;

      const symbols = validator.extractSymbols('test.ts', content, true, true);

      const classes = symbols.filter(s => s.type === 'class');
      const methods = symbols.filter(s => s.type === 'method');
      const properties = symbols.filter(s => s.type === 'property');

      expect(classes).toHaveLength(2);
      expect(methods).toHaveLength(4); // innerMethod, staticMethod, constructor, asyncMethod
      expect(properties).toHaveLength(4); // innerProperty, publicProp, privateProp, protectedProp

      // Check parent relationships
      const innerMethod = symbols.find(s => s.name === 'innerMethod');
      expect(innerMethod?.parent).toBe('OuterClass');

      const asyncMethod = symbols.find(s => s.name === 'asyncMethod');
      expect(asyncMethod?.parent).toBe('AnotherClass');
    });

    test('should handle arrow functions with different syntaxes', () => {
      const content = `
export const arrow1 = () => {};
const arrow2 = () => 'hello';
export const arrow3 = (x: number) => x * 2;
const arrow4 = async () => await fetch();
export const arrow5 = async (data: any) => {
  return process(data);
};
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      expect(symbols).toHaveLength(5);

      const exported = symbols.filter(s => s.isExported);
      const notExported = symbols.filter(s => !s.isExported);

      expect(exported).toHaveLength(3); // arrow1, arrow3, arrow5
      expect(notExported).toHaveLength(2); // arrow2, arrow4
    });

    test('should handle mixed export syntax', () => {
      const content = `
function regularFunction() {}
const arrowFunc = () => {};
class MyClass {}
interface MyInterface {}
type MyType = string;
enum MyEnum { A, B }

export { regularFunction, arrowFunc };
export { MyClass as RenamedClass };
export default MyInterface;
export type { MyType };
export { MyEnum };
`;

      const symbols = validator.extractSymbols('test.ts', content, true);

      // Should extract the original declarations (not the export statements)
      const functions = symbols.filter(s => s.type === 'function');
      const classes = symbols.filter(s => s.type === 'class');
      const interfaces = symbols.filter(s => s.type === 'interface');
      const types = symbols.filter(s => s.type === 'type');
      const enums = symbols.filter(s => s.type === 'enum');

      expect(functions).toHaveLength(2);
      expect(classes).toHaveLength(1);
      expect(interfaces).toHaveLength(1);
      expect(types).toHaveLength(1);
      expect(enums).toHaveLength(1);
    });
  });

  describe('symbol index edge cases', () => {
    test('should handle symbols with same names in different files', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cross-ref-test-'));

      try {
        const file1Content = 'export function process() { return "file1"; }';
        const file2Content = 'export function process() { return "file2"; }';

        await fs.writeFile(path.join(tempDir, 'file1.ts'), file1Content);
        await fs.writeFile(path.join(tempDir, 'file2.ts'), file2Content);

        const index = await validator.buildIndex(tempDir);

        const processSymbols = validator.lookupSymbol(index, 'process');
        expect(processSymbols).toHaveLength(2);
        expect(processSymbols[0].file).not.toBe(processSymbols[1].file);
        expect(processSymbols.every(s => s.name === 'process')).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should handle empty files correctly', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cross-ref-test-'));

      try {
        await fs.writeFile(path.join(tempDir, 'empty.ts'), '');
        await fs.writeFile(path.join(tempDir, 'whitespace.ts'), '   \n\n   \t\t  \n');
        await fs.writeFile(path.join(tempDir, 'comments-only.ts'), '// just a comment\n/* another comment */');

        const index = await validator.buildIndex(tempDir);

        expect(index.stats.totalFiles).toBe(3);
        expect(index.stats.totalSymbols).toBe(0);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    test('should handle files with Unicode characters', () => {
      const content = `
export function processData🚀() {}
export class UserManager用户 {}
export interface Config配置 {
  name: string;
}
`;

      const symbols = validator.extractSymbols('unicode.ts', content);

      // Unicode characters in function/class names should work
      expect(symbols.find(s => s.name === 'processData🚀')).toBeDefined();
      expect(symbols.find(s => s.name === 'UserManager用户')).toBeDefined();
      expect(symbols.find(s => s.name === 'Config配置')).toBeDefined();
    });
  });

  describe('complex JSDoc extraction', () => {
    test('should handle complex JSDoc with multiple tags', () => {
      const content = `
/**
 * Complex function with detailed documentation
 *
 * This function does many things and has complex behavior.
 * It spans multiple lines and has various JSDoc tags.
 *
 * @param {string} input - The input string to process
 * @param {Object} options - Configuration options
 * @param {boolean} options.strict - Whether to use strict mode
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @returns {Promise<string>} A promise that resolves to processed string
 * @throws {Error} When input is invalid
 * @example
 * const result = await complexFunction('hello', { strict: true });
 * console.log(result);
 *
 * @since 1.0.0
 * @deprecated Use simpleFunction instead
 * @see {@link simpleFunction}
 */
export async function complexFunction(input: string, options: any): Promise<string> {
  return input;
}
`;

      const symbols = validator.extractSymbols('test.ts', content);

      expect(symbols).toHaveLength(1);
      const func = symbols[0];
      expect(func.name).toBe('complexFunction');
      expect(func.documentation).toBeTruthy();
      expect(func.documentation).toContain('Complex function with detailed documentation');
      expect(func.documentation).toContain('@param');
      expect(func.documentation).toContain('@returns');
    });

    test('should handle JSDoc blocks in different positions', () => {
      const content = `
/**
 * First function documentation
 */
export function first() {}

// Comment between functions

/**
 * Second function documentation
 * with multiple lines
 */
function second() {}

export class TestClass {
  /**
   * Method documentation
   */
  methodWithDocs() {}

  methodWithoutDocs() {}
}
`;

      const symbols = validator.extractSymbols('test.ts', content, true, true);

      const first = symbols.find(s => s.name === 'first');
      const second = symbols.find(s => s.name === 'second');
      const methodWithDocs = symbols.find(s => s.name === 'methodWithDocs');
      const methodWithoutDocs = symbols.find(s => s.name === 'methodWithoutDocs');

      expect(first?.documentation).toBe('First function documentation');
      expect(second?.documentation).toBe('Second function documentation with multiple lines');
      expect(methodWithDocs?.documentation).toBe('Method documentation');
      expect(methodWithoutDocs?.documentation).toBeUndefined();
    });
  });

  describe('glob pattern matching edge cases', () => {
    test('should handle complex glob patterns correctly', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cross-ref-test-'));

      try {
        // Create directory structure
        await fs.mkdir(path.join(tempDir, 'src'));
        await fs.mkdir(path.join(tempDir, 'src', 'components'));
        await fs.mkdir(path.join(tempDir, 'tests'));
        await fs.mkdir(path.join(tempDir, 'lib'));

        await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export function main() {}');
        await fs.writeFile(path.join(tempDir, 'src', 'components', 'button.tsx'), 'export function Button() {}');
        await fs.writeFile(path.join(tempDir, 'tests', 'index.test.ts'), 'function test() {}');
        await fs.writeFile(path.join(tempDir, 'lib', 'utils.js'), 'export function util() {}');

        // Test specific include patterns
        const index1 = await validator.buildIndex(tempDir, {
          include: ['src/**/*.ts'],
          exclude: []
        });

        expect(index1.stats.totalFiles).toBe(1); // Only src/index.ts

        // Test excluding test files
        const index2 = await validator.buildIndex(tempDir, {
          include: ['**/*'],
          exclude: ['**/*.test.*', '**/*.spec.*']
        });

        expect(index2.byName.has('test')).toBe(false);
        expect(index2.byName.has('main')).toBe(true);
        expect(index2.byName.has('Button')).toBe(true);
        expect(index2.byName.has('util')).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('performance and memory considerations', () => {
    test('should handle large number of symbols efficiently', () => {
      // Generate a large file with many symbols
      const lines = ['// Large test file'];
      for (let i = 0; i < 1000; i++) {
        lines.push(`export function func${i}() { return ${i}; }`);
        lines.push(`export const CONST${i} = ${i};`);
        if (i % 100 === 0) {
          lines.push(`export class Class${i} { prop${i}: number = ${i}; }`);
        }
      }

      const content = lines.join('\n');
      const symbols = validator.extractSymbols('large.ts', content);

      expect(symbols.length).toBeGreaterThan(1000);

      // Verify all functions are captured
      const functions = symbols.filter(s => s.type === 'function');
      expect(functions).toHaveLength(1000);

      // Verify constants are captured
      const constants = symbols.filter(s => s.type === 'const');
      expect(constants).toHaveLength(1000);

      // Verify classes are captured
      const classes = symbols.filter(s => s.type === 'class');
      expect(classes).toHaveLength(10); // Every 100th iteration
    });
  });
});

describe('Documentation Reference Extraction', () => {
  let validator: CrossReferenceValidator;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
  });

  describe('extractInlineCodeReferences', () => {
    test('should extract function references with parentheses', () => {
      const content = `
This documentation explains how to use \`processData()\` function.
You can also call \`calculateSum()\` to get the result.
The \`UserService\` class provides these methods.
`;

      const references = validator.extractInlineCodeReferences('README.md', content);

      expect(references).toHaveLength(3);

      expect(references[0]).toEqual({
        symbolName: 'processData',
        referenceType: 'inline-code',
        sourceFile: 'README.md',
        line: 2,
        column: 46,
        context: 'This documentation explains how to use `processData()` function.',
      });

      expect(references[1]).toEqual({
        symbolName: 'calculateSum',
        referenceType: 'inline-code',
        sourceFile: 'README.md',
        line: 3,
        column: 21,
        context: 'You can also call `calculateSum()` to get the result.',
      });

      expect(references[2]).toEqual({
        symbolName: 'UserService',
        referenceType: 'inline-code',
        sourceFile: 'README.md',
        line: 4,
        column: 5,
        context: 'The `UserService` class provides these methods.',
      });
    });

    test('should extract class and type references', () => {
      const content = `
The \`ApiClient\` handles HTTP requests.
Use the \`Configuration\` interface to set up options.
The \`ResponseType\` defines the expected response format.
`;

      const references = validator.extractInlineCodeReferences('docs.md', content);

      expect(references).toHaveLength(3);
      expect(references[0].symbolName).toBe('ApiClient');
      expect(references[1].symbolName).toBe('Configuration');
      expect(references[2].symbolName).toBe('ResponseType');
    });

    test('should handle multiple references on same line', () => {
      const content = 'Use `UserService` to call `createUser()` and `deleteUser()` methods.';

      const references = validator.extractInlineCodeReferences('test.md', content);

      expect(references).toHaveLength(3);
      expect(references[0].symbolName).toBe('UserService');
      expect(references[1].symbolName).toBe('createUser');
      expect(references[2].symbolName).toBe('deleteUser');
    });

    test('should ignore non-symbol inline code', () => {
      const content = `
Use \`npm install\` to install dependencies.
The \`package.json\` file contains configuration.
Set \`NODE_ENV=production\` for production builds.
`;

      const references = validator.extractInlineCodeReferences('guide.md', content);

      // Should not extract file names, environment variables, or commands
      expect(references).toHaveLength(0);
    });
  });

  describe('extractSeeTagReferences', () => {
    test('should extract references from @see tags', () => {
      const content = `
/**
 * Process user data
 * @see processData
 * @see UserService
 * @see {@link Configuration}
 */
function handleUser() {}

/**
 * Another function
 * @see utils.formatDate
 * @see Module.HelperClass
 */
function format() {}
`;

      const references = validator.extractSeeTagReferences('service.ts', content);

      expect(references).toHaveLength(5);

      expect(references[0]).toEqual({
        symbolName: 'processData',
        referenceType: 'see-tag',
        sourceFile: 'service.ts',
        line: 4,
        column: 5,
        context: ' * @see processData',
      });

      expect(references[1]).toEqual({
        symbolName: 'UserService',
        referenceType: 'see-tag',
        sourceFile: 'service.ts',
        line: 5,
        column: 5,
        context: ' * @see UserService',
      });

      expect(references[2]).toEqual({
        symbolName: 'Configuration',
        referenceType: 'see-tag',
        sourceFile: 'service.ts',
        line: 6,
        column: 5,
        context: ' * @see {@link Configuration}',
      });

      // Dotted references should extract the last part
      expect(references[3].symbolName).toBe('formatDate');
      expect(references[4].symbolName).toBe('HelperClass');
    });

    test('should handle different @see tag formats', () => {
      const content = `
/**
 * @see functionName
 * @see {functionWithBraces}
 * @see {@link ClassName}
 * @see package.module.functionName
 */
`;

      const references = validator.extractSeeTagReferences('docs.ts', content);

      expect(references).toHaveLength(4);
      expect(references[0].symbolName).toBe('functionName');
      expect(references[1].symbolName).toBe('{functionWithBraces}'); // This might be cleaned later
      expect(references[2].symbolName).toBe('ClassName');
      expect(references[3].symbolName).toBe('functionName'); // Last part of dotted reference
    });
  });

  describe('extractCodeBlockReferences', () => {
    test('should extract symbols from JavaScript code blocks', () => {
      const content = `
# Example Usage

\`\`\`javascript
const client = new ApiClient();
const result = await client.processData();
console.log(result);
\`\`\`

## Another Example

\`\`\`typescript
class UserService extends BaseService {
  createUser(data: UserData): Promise<User> {
    return this.api.post('/users', data);
  }
}
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('example.md', content);

      // Should extract class names and function calls
      const symbolNames = references.map(ref => ref.symbolName);
      expect(symbolNames).toContain('ApiClient');
      expect(symbolNames).toContain('processData');
      expect(symbolNames).toContain('UserService');
      expect(symbolNames).toContain('BaseService');
      expect(symbolNames).toContain('createUser');

      // Check that they are marked as code-block references
      expect(references.every(ref => ref.referenceType === 'code-block')).toBe(true);
    });

    test('should extract from code blocks without language specification', () => {
      const content = `
\`\`\`
const service = new DataProcessor();
service.validateInput(data);
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('readme.md', content);

      const symbolNames = references.map(ref => ref.symbolName);
      expect(symbolNames).toContain('DataProcessor');
      expect(symbolNames).toContain('validateInput');
    });

    test('should handle multiple code blocks', () => {
      const content = `
\`\`\`javascript
new UserManager();
\`\`\`

Some text in between.

\`\`\`typescript
class TaskRunner {
  execute() {}
}
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('guide.md', content);

      const symbolNames = references.map(ref => ref.symbolName);
      expect(symbolNames).toContain('UserManager');
      expect(symbolNames).toContain('TaskRunner');
      expect(symbolNames).toContain('execute');
    });

    test('should ignore common JavaScript built-ins', () => {
      const content = `
\`\`\`javascript
console.log('Hello');
setTimeout(() => {}, 1000);
const date = new Date();
const array = new Array();
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('test.md', content);

      // Should not extract built-in JavaScript functions/classes
      const symbolNames = references.map(ref => ref.symbolName);
      expect(symbolNames).not.toContain('console');
      expect(symbolNames).not.toContain('log');
      expect(symbolNames).not.toContain('setTimeout');
      expect(symbolNames).not.toContain('Date');
      expect(symbolNames).not.toContain('Array');
    });
  });

  describe('extractDocumentationReferences (integration)', () => {
    test('should extract all types of references from mixed content', () => {
      const content = `
# API Documentation

This guide explains how to use the \`UserService\` class.

## Overview

The \`UserService\` provides methods for user management:

\`\`\`javascript
const service = new UserService();
const user = await service.createUser(userData);
\`\`\`

## Methods

### createUser()

Creates a new user account.

/**
 * Creates a user
 * @see validateUser
 * @see {@link UserData}
 */

You can also use \`updateUser()\` to modify existing accounts.

\`\`\`typescript
interface UserData {
  name: string;
  email: string;
}

class UserValidator {
  validateUser(data: UserData): boolean {
    return true;
  }
}
\`\`\`
`;

      const references = validator.extractDocumentationReferences('api.md', content);

      // Should find inline code, see tags, and code block references
      const inlineRefs = references.filter(r => r.referenceType === 'inline-code');
      const seeRefs = references.filter(r => r.referenceType === 'see-tag');
      const codeRefs = references.filter(r => r.referenceType === 'code-block');

      expect(inlineRefs.length).toBeGreaterThan(0);
      expect(seeRefs.length).toBeGreaterThan(0);
      expect(codeRefs.length).toBeGreaterThan(0);

      const allSymbols = references.map(r => r.symbolName);
      expect(allSymbols).toContain('UserService');
      expect(allSymbols).toContain('createUser');
      expect(allSymbols).toContain('validateUser');
      expect(allSymbols).toContain('UserData');
      expect(allSymbols).toContain('updateUser');
      expect(allSymbols).toContain('UserValidator');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty content', () => {
      const references = validator.extractDocumentationReferences('empty.md', '');
      expect(references).toHaveLength(0);
    });

    test('should handle content with no references', () => {
      const content = 'This is plain text with no code references.';
      const references = validator.extractDocumentationReferences('plain.md', content);
      expect(references).toHaveLength(0);
    });

    test('should handle malformed code blocks', () => {
      const content = `
\`\`\`javascript
// Unclosed code block
const service = new ServiceClass();
`;
      // Should not throw, just return what it can parse
      const references = validator.extractDocumentationReferences('malformed.md', content);
      expect(Array.isArray(references)).toBe(true);
    });

    test('should handle special characters in symbol names', () => {
      const content = 'Use the \`$specialFunction\` and \`_privateMethod()\` functions.';
      const references = validator.extractInlineCodeReferences('special.md', content);

      expect(references).toHaveLength(2);
      expect(references[0].symbolName).toBe('$specialFunction');
      expect(references[1].symbolName).toBe('_privateMethod');
    });

    test('should provide correct line numbers and context', () => {
      const content = `Line 1
Line 2 with \`SymbolName\`
Line 3
\`\`\`javascript
new TestClass();
\`\`\`
Line 7`;

      const references = validator.extractDocumentationReferences('test.md', content);

      const inlineRef = references.find(r => r.referenceType === 'inline-code');
      expect(inlineRef?.line).toBe(2);
      expect(inlineRef?.context).toBe('Line 2 with `SymbolName`');

      const codeRef = references.find(r => r.symbolName === 'TestClass');
      expect(codeRef?.referenceType).toBe('code-block');
    });
  });

  describe('isValidSymbolReference', () => {
    test('should filter out JavaScript keywords and built-ins', () => {
      const testSymbols = [
        'MyClass', // valid
        'myFunction', // valid
        'console', // invalid - built-in
        'Promise', // invalid - built-in
        'if', // invalid - keyword
        'function', // invalid - keyword
        'a', // invalid - too short
        '', // invalid - empty
        '123invalid', // invalid - starts with number
        'valid$name', // valid - contains $
        '_validName', // valid - starts with _
      ];

      const validator = new CrossReferenceValidator();
      const validSymbols = testSymbols.filter(symbol =>
        (validator as any).isValidSymbolReference(symbol)
      );

      expect(validSymbols).toEqual(['MyClass', 'myFunction', 'valid$name', '_validName']);
    });
  });
});