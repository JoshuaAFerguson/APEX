import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from '../idle-processor.js';
import { TaskStore } from '../store.js';
import type { DaemonConfig } from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('../store.js', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
    getAllTasks: vi.fn().mockResolvedValue([]),
    getTasksByStatus: vi.fn().mockResolvedValue([]),
  })),
}));

const mockExecAsync = vi.fn();
vi.mock('child_process', () => ({
  exec: (command: string, options: any, callback: Function) => {
    mockExecAsync(command, options).then((result: any) => {
      callback(null, result);
    }).catch((error: any) => {
      callback(error);
    });
  },
}));

vi.mock('util', () => ({
  promisify: (fn: Function) => fn,
}));

describe('Untested Exports - Edge Cases and Error Handling', () => {
  let idleProcessor: IdleProcessor;
  let mockConfig: DaemonConfig;
  let mockStore: TaskStore;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      installAsService: false,
      serviceName: 'apex-daemon',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = new TaskStore(':memory:');
    idleProcessor = new IdleProcessor('/test/project', mockConfig, mockStore);
  });

  describe('extractPublicExports - Edge Cases', () => {
    it('should handle malformed TypeScript code gracefully', () => {
      const malformedCode = `
export function incomplete(
// Missing closing parenthesis and body

export class MissingBrace {
  method()
// Missing brace

export const incomplete =
// Missing assignment

export interface Bad extends
// Missing extension
`;

      expect(() => {
        (idleProcessor as any).extractPublicExports(malformedCode, './bad.ts');
      }).not.toThrow();

      const exports = (idleProcessor as any).extractPublicExports(malformedCode, './bad.ts');
      expect(Array.isArray(exports)).toBe(true);
    });

    it('should handle empty and whitespace-only files', () => {
      expect((idleProcessor as any).extractPublicExports('', './empty.ts')).toEqual([]);
      expect((idleProcessor as any).extractPublicExports('   \n\n   \t  ', './whitespace.ts')).toEqual([]);
      expect((idleProcessor as any).extractPublicExports('// Only comments\n/* More comments */', './comments.ts')).toEqual([]);
    });

    it('should handle complex nested class structures', () => {
      const complexClassCode = `
export class OuterClass {
  static staticProperty = 'value';

  static staticMethod() {}

  async asyncMethod() {}

  private get privateGetter() {}

  public set publicSetter(value: any) {}

  public readonly readonlyProp = 'readonly';

  constructor(private privateParam: string, public publicParam: number) {}

  public methodWithGenerics<T extends string>(param: T): T { return param; }
}

export abstract class AbstractClass {
  abstract abstractMethod(): void;

  protected protectedMethod() {}
}

export class GenericClass<T, U extends string> {
  method<K>(param: K): K { return param; }
}
`;

      const exports = (idleProcessor as any).extractPublicExports(complexClassCode, './complex.ts');

      expect(exports.length).toBeGreaterThan(0);

      // Should find classes
      expect(exports.some((exp: any) => exp.name === 'OuterClass')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'AbstractClass')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'GenericClass')).toBe(true);

      // Should find public methods
      expect(exports.some((exp: any) => exp.name.includes('staticMethod'))).toBe(true);
      expect(exports.some((exp: any) => exp.name.includes('asyncMethod'))).toBe(true);
      expect(exports.some((exp: any) => exp.name.includes('methodWithGenerics'))).toBe(true);

      // Should not find private members or constructor
      expect(exports.some((exp: any) => exp.name.includes('constructor'))).toBe(false);
      expect(exports.some((exp: any) => exp.name.includes('privateGetter'))).toBe(false);
    });

    it('should handle various export patterns and edge syntax', () => {
      const edgeCases = `
// Default exports (should be ignored as we focus on named exports)
export default function defaultFunc() {}
export default class DefaultClass {}

// Re-exports
export { something } from 'other-module';
export { renamed as aliased } from 'other-module';
export * from 'other-module';
export * as namespace from 'other-module';

// Named exports we should catch
export function normalFunction() {}
export { namedFunction };
export { renamedFunction as publicFunction };

// Inline exports
export { inline1, inline2 } from './inline';

// Complex types
export type ComplexType<T> = {
  [K in keyof T]: T[K] extends string ? number : T[K];
};

export interface GenericInterface<T, U = string> {
  prop: T;
  method(param: U): void;
}

// Conditional exports in code
if (process.env.NODE_ENV === 'development') {
  export function devOnlyFunction() {}
}
`;

      const exports = (idleProcessor as any).extractPublicExports(edgeCases, './edge.ts');

      // Should find standard exports
      expect(exports.some((exp: any) => exp.name === 'normalFunction')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'ComplexType')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'GenericInterface')).toBe(true);
    });

    it('should handle files with mixed JavaScript and TypeScript syntax', () => {
      const mixedCode = `
// TypeScript-style exports
export interface TSInterface {
  prop: string;
}

export type TSType = string | number;

// JavaScript-style exports
export function jsFunction() {
  return 'js';
}

export const jsConst = 'constant';

// Mixed syntax
export const tsFunction: (param: string) => number = (param) => param.length;

module.exports = { shouldBeIgnored: true };
`;

      const exports = (idleProcessor as any).extractPublicExports(mixedCode, './mixed.js');

      expect(exports.some((exp: any) => exp.name === 'TSInterface')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'TSType')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'jsFunction')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'jsConst')).toBe(true);
      expect(exports.some((exp: any) => exp.name === 'tsFunction')).toBe(true);
    });
  });

  describe('isExportPublic - Edge Cases', () => {
    it('should correctly identify private exports by naming convention', () => {
      const testCases = [
        { name: '_private', expected: false },
        { name: '__internal', expected: false },
        { name: 'publicFunction', expected: true },
        { name: 'internalHelper', expected: false },
        { name: 'privateMethod', expected: false },
        { name: 'normalFunction', expected: true },
        { name: 'MyClass.publicMethod', expected: true },
        { name: 'MyClass._privateMethod', expected: false },
      ];

      testCases.forEach(({ name, expected }) => {
        const isPublic = (idleProcessor as any).isExportPublic(name, './src/test.ts');
        expect(isPublic).toBe(expected);
      });
    });

    it('should identify private exports by file path patterns', () => {
      const testCases = [
        { path: './src/internal/utils.ts', expected: false },
        { path: './src/private/helpers.ts', expected: false },
        { path: './src/__tests__/test-utils.ts', expected: false },
        { path: './src/types.d.ts', expected: false },
        { path: './src/api/public.ts', expected: true },
        { path: './src/utils/format.ts', expected: true },
      ];

      testCases.forEach(({ path, expected }) => {
        const isPublic = (idleProcessor as any).isExportPublic('testFunction', path);
        expect(isPublic).toBe(expected);
      });
    });
  });

  describe('checkIfExportHasAdvancedTest - Complex Scenarios', () => {
    it('should handle complex test file naming patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);

      // Test various file naming patterns
      const testPatterns = [
        './src/utils.test.ts',
        './src/utils.spec.ts',
        './test/utils.test.ts',
        './__tests__/utils.test.ts',
        './test/utils.ts',
      ];

      mockReadFile.mockImplementation(async (path: string) => {
        if (testPatterns.some(pattern => path.toString().includes('utils.test.ts'))) {
          return 'import { testFunction } from "../src/utils"; describe("testFunction", () => {});';
        }
        throw new Error('File not found');
      });

      const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/utils.ts',
        'testFunction'
      );

      expect(hasTest).toBe(true);
    });

    it('should handle test files with complex import patterns', async () => {
      const complexTestFile = `
import * as utils from '../src/utils';
import { default as defaultExport, named1, named2 as aliased } from '../src/exports';
import type { TypeOnlyImport } from '../src/types';

// Dynamic imports
const dynamicModule = await import('../src/dynamic');

// Require statements
const requiredModule = require('../src/required');

describe('Complex Test Suite', () => {
  it('should test named1', () => {
    expect(named1()).toBeDefined();
  });

  it('should test aliased (renamed from named2)', () => {
    expect(aliased()).toBeDefined();
  });

  it('should test utils.testFunction', () => {
    expect(utils.testFunction()).toBeDefined();
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(complexTestFile);

      // Test various scenarios
      const testCases = [
        { file: './src/exports.ts', export: 'named1', expected: true },
        { file: './src/exports.ts', export: 'named2', expected: true },
        { file: './src/utils.ts', export: 'testFunction', expected: true },
        { file: './src/dynamic.ts', export: 'dynamicFunction', expected: false }, // Not directly tested
        { file: './src/required.ts', export: 'requiredFunction', expected: false }, // Not directly tested
      ];

      for (const { file, export: exportName, expected } of testCases) {
        const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(file, exportName);
        expect(hasTest).toBe(expected);
      }
    });

    it('should handle test files with regex-sensitive names', async () => {
      const testFile = `
import { $special, regexp.test, char+plus } from '../src/special-chars';

describe('Special Characters', () => {
  test('$special function', () => {
    expect($special()).toBeDefined();
  });

  test('regexp.test method', () => {
    expect(regexp.test('pattern')).toBe(true);
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(testFile);

      const specialCharTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/special-chars.ts',
        '$special'
      );

      const dotMethodTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/special-chars.ts',
        'regexp.test'
      );

      expect(specialCharTest).toBe(true);
      expect(dotMethodTest).toBe(true);
    });
  });

  describe('analyzeUntestedExports - Error Handling and Performance', () => {
    it('should handle file read errors gracefully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: './src/test1.ts\n./src/test2.ts', stderr: '' });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce('export function workingFunction() {}')
        .mockRejectedValueOnce(new Error('File not found'));

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      // Should not throw and should return partial results
      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports.some((exp: any) => exp.exportName === 'workingFunction')).toBe(true);
    });

    it('should handle timeout and performance issues', async () => {
      // Simulate a very large number of files
      const manyFiles = Array.from({ length: 200 }, (_, i) => `./src/file${i}.ts`).join('\n');

      mockExecAsync.mockResolvedValue({ stdout: manyFiles, stderr: '' });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockImplementation(async (path: string) => {
        // Simulate slow file reads
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'export function testFunc() {}';
      });

      const startTime = Date.now();
      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();
      const endTime = Date.now();

      // Should complete within reasonable time (less than 5 seconds for this test)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should limit results to prevent memory issues
      expect(untestedExports.length).toBeLessThanOrEqual(30);
    });

    it('should handle circular dependencies and complex import graphs', async () => {
      const circularFiles = {
        './src/a.ts': 'export { b } from "./b"; export function funcA() {}',
        './src/b.ts': 'export { a } from "./a"; export function funcB() {}',
      };

      mockExecAsync.mockResolvedValue({ stdout: './src/a.ts\n./src/b.ts', stderr: '' });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockImplementation(async (path: string) => {
        return circularFiles[path as keyof typeof circularFiles] || '';
      });

      expect(async () => {
        await (idleProcessor as any).analyzeUntestedExports();
      }).not.toThrow();
    });

    it('should handle files with different encodings and special characters', async () => {
      const unicodeContent = `
// 测试文件
export function 测试函数() {
  return '🎉';
}

export const émoji = '🚀';

export interface Iñtërnâtiônàl {
  naïve: string;
  café: number;
}
`;

      mockExecAsync.mockResolvedValue({ stdout: './src/unicode.ts', stderr: '' });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(unicodeContent);

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      // Should handle Unicode characters in export names
      expect(untestedExports.some((exp: any) => exp.exportName === '测试函数')).toBe(true);
      expect(untestedExports.some((exp: any) => exp.exportName === 'émoji')).toBe(true);
      expect(untestedExports.some((exp: any) => exp.exportName === 'Iñtërnâtiônàl')).toBe(true);
    });
  });

  describe('normalizeExportType', () => {
    it('should normalize export types correctly', () => {
      const testCases = [
        { input: 'let', expected: 'variable' },
        { input: 'var', expected: 'variable' },
        { input: 'const', expected: 'const' },
        { input: 'function', expected: 'function' },
        { input: 'class', expected: 'class' },
        { input: 'interface', expected: 'interface' },
        { input: 'type', expected: 'type' },
        { input: 'enum', expected: 'enum' },
        { input: 'namespace', expected: 'namespace' },
        { input: 'unknown', expected: 'function' }, // Default fallback
        { input: 'LET', expected: 'variable' }, // Case insensitive
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = (idleProcessor as any).normalizeExportType(input);
        expect(normalized).toBe(expected);
      });
    });
  });

  describe('escapeRegex', () => {
    it('should escape regex special characters correctly', () => {
      const testCases = [
        { input: 'normal', expected: 'normal' },
        { input: '$special', expected: '\\$special' },
        { input: 'function.method', expected: 'function\\.method' },
        { input: 'array[0]', expected: 'array\\[0\\]' },
        { input: '(param)', expected: '\\(param\\)' },
        { input: 'a+b*c?d^e', expected: 'a\\+b\\*c\\?d\\^e' },
        { input: 'a|b{2,3}', expected: 'a\\|b\\{2,3\\}' },
      ];

      testCases.forEach(({ input, expected }) => {
        const escaped = (idleProcessor as any).escapeRegex(input);
        expect(escaped).toBe(expected);
      });
    });
  });
});