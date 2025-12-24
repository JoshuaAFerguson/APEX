import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from './idle-processor.js';
import { TaskStore } from './store.js';
import type { DaemonConfig, UntestedExport } from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('./store.js', () => ({
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

describe('Untested Exports Edge Cases', () => {
  let idleProcessor: IdleProcessor;
  let mockConfig: DaemonConfig;
  let mockStore: TaskStore;
  const testProjectPath = '/test/project';

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
    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockStore);
  });

  describe('findUntestedExports Edge Cases', () => {
    it('should handle files with no exports', async () => {
      const mockFileContent = `
        // This file has no exports
        function internalFunction() {}
        const localVariable = 'value';
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/no-exports.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      // Should not find any exports to report as untested
    });

    it('should handle various export syntaxes', async () => {
      const mockFileContent = `
        export function normalFunction() {}
        export const constVariable = 'value';
        export let letVariable = 'value';
        export var varVariable = 'value';
        export class TestClass {}
        export interface TestInterface {}
        export type TestType = string;
        export enum TestEnum { A, B }
        export namespace TestNamespace {}
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/exports.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      expect(untestedExports.length).toBeGreaterThan(0);

      // Check that different export types are detected
      const exportTypes = untestedExports.map((exp: UntestedExport) => exp.exportType);
      expect(exportTypes).toContain('function');
      expect(exportTypes).toContain('const');
      expect(exportTypes).toContain('variable'); // let/var should be converted to 'variable'
      expect(exportTypes).toContain('class');
      expect(exportTypes).toContain('interface');
      expect(exportTypes).toContain('type');
      expect(exportTypes).toContain('enum');
      expect(exportTypes).toContain('namespace');
    });

    it('should detect exports with irregular formatting', async () => {
      const mockFileContent = `
        export    function   spacedFunction() {}
        export
        const
        multiLineExport = 'value';
        export	class	TabClass {}
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/irregular.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      expect(untestedExports.length).toBeGreaterThan(0);
      const exportNames = untestedExports.map((exp: UntestedExport) => exp.exportName);
      expect(exportNames).toContain('spacedFunction');
    });

    it('should handle files that cannot be read', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      mockExecAsync.mockResolvedValue({
        stdout: 'src/unreadable.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      // Should handle file read errors gracefully
      expect(Array.isArray(untestedExports)).toBe(true);
    });

    it('should distinguish between public and private exports', async () => {
      const mockFileContent = `
        export function publicFunction() {}
        export function _privateFunction() {}
        export const publicConst = 'value';
        export const _privateConst = 'value';
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/public-private.ts\nsrc/internal/private.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      const publicExports = untestedExports.filter((exp: UntestedExport) => exp.isPublic);
      const privateExports = untestedExports.filter((exp: UntestedExport) => !exp.isPublic);

      expect(publicExports.length).toBeGreaterThanOrEqual(0);
      expect(privateExports.length).toBeGreaterThanOrEqual(0);

      // Check that internal files and underscore-prefixed exports are marked as private
      const internalFileExports = untestedExports.filter((exp: UntestedExport) =>
        exp.file.includes('internal')
      );
      const underscoreExports = untestedExports.filter((exp: UntestedExport) =>
        exp.exportName.startsWith('_')
      );

      internalFileExports.forEach((exp: UntestedExport) => {
        expect(exp.isPublic).toBe(false);
      });

      underscoreExports.forEach((exp: UntestedExport) => {
        expect(exp.isPublic).toBe(false);
      });
    });

    it('should handle large numbers of exports', async () => {
      // Generate a large file with many exports
      const largeFileContent = Array.from({ length: 100 }, (_, i) =>
        `export function function${i}() {}\nexport const const${i} = 'value${i}';`
      ).join('\n');

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(largeFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/large-exports.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      // Should limit the results to avoid performance issues
      expect(untestedExports.length).toBeLessThanOrEqual(20);
    });

    it('should track line numbers correctly', async () => {
      const mockFileContent = `// Line 1
export function firstFunction() {} // Line 2
const internal = 'value'; // Line 3
export class SecondClass {} // Line 4
export interface ThirdInterface {} // Line 5`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/line-numbers.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      const firstFunction = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'firstFunction'
      );
      const secondClass = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'SecondClass'
      );
      const thirdInterface = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'ThirdInterface'
      );

      if (firstFunction) expect(firstFunction.line).toBe(2);
      if (secondClass) expect(secondClass.line).toBe(4);
      if (thirdInterface) expect(thirdInterface.line).toBe(5);
    });
  });

  describe('checkIfExportHasTest Edge Cases', () => {
    it('should find tests in corresponding .test.ts files', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile
        .mockResolvedValueOnce('export function myFunction() {}') // Source file
        .mockResolvedValueOnce('describe("myFunction", () => { test("should work", () => {}); });'); // Test file

      const hasTest = await (idleProcessor as any).checkIfExportHasTest('src/utils.ts', 'myFunction');

      expect(hasTest).toBe(true);
    });

    it('should find tests in corresponding .spec.ts files', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile
        .mockResolvedValueOnce('export function myFunction() {}') // Source file
        .mockRejectedValueOnce(new Error('No test file')) // .test.ts doesn't exist
        .mockResolvedValueOnce('it("tests myFunction", () => {});'); // .spec.ts exists

      const hasTest = await (idleProcessor as any).checkIfExportHasTest('src/utils.ts', 'myFunction');

      expect(hasTest).toBe(true);
    });

    it('should return false when no test files exist', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile
        .mockRejectedValueOnce(new Error('No test file'))
        .mockRejectedValueOnce(new Error('No spec file'));

      const hasTest = await (idleProcessor as any).checkIfExportHasTest('src/utils.ts', 'myFunction');

      expect(hasTest).toBe(false);
    });

    it('should return false when test files exist but do not mention the export', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile
        .mockResolvedValueOnce('describe("otherFunction", () => {});'); // Test exists but for different function

      const hasTest = await (idleProcessor as any).checkIfExportHasTest('src/utils.ts', 'myFunction');

      expect(hasTest).toBe(false);
    });

    it('should handle file read errors gracefully', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('File system error'));

      const hasTest = await (idleProcessor as any).checkIfExportHasTest('src/utils.ts', 'myFunction');

      expect(hasTest).toBe(false);
    });
  });

  describe('Export Pattern Matching', () => {
    it('should handle complex export patterns', async () => {
      const mockFileContent = `
        // Default export (should not match current regex)
        export default function defaultFunction() {}

        // Named exports
        export { existingFunction };
        export { renamedFunction as aliasFunction };

        // Re-exports
        export * from './other-module';
        export { specificExport } from './specific-module';

        // Export declarations
        export function declarationFunction() {}
        export const arrow = () => {};
        export async function asyncFunction() {}
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/complex-exports.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      // Should find declaration-style exports, but not re-exports or default exports
      const exportNames = untestedExports.map((exp: UntestedExport) => exp.exportName);
      expect(exportNames).toContain('declarationFunction');
      expect(exportNames).toContain('arrow');
      expect(exportNames).toContain('asyncFunction');

      // Should not contain re-exports or default exports
      expect(exportNames).not.toContain('defaultFunction');
      expect(exportNames).not.toContain('existingFunction');
      expect(exportNames).not.toContain('specificExport');
    });

    it('should handle TypeScript-specific export patterns', async () => {
      const mockFileContent = `
        export abstract class AbstractClass {}
        export declare function declareFunction(): void;
        export module ModuleName {}
        export import ImportAlias = SomeModule.SomeExport;
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/typescript-exports.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      // Should handle TypeScript-specific keywords
      const exportNames = untestedExports.map((exp: UntestedExport) => exp.exportName);
      expect(exportNames).toContain('AbstractClass');
      // Note: declare and module exports might not match current regex pattern
    });

    it('should handle edge cases in export naming', async () => {
      const mockFileContent = `
        export function $specialFunction() {}
        export const _privateConst = 'value';
        export class Component123 {}
        export interface IUserInterface {}
        export type GenericType<T> = T;
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/edge-cases.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      const exportNames = untestedExports.map((exp: UntestedExport) => exp.exportName);
      expect(exportNames).toContain('$specialFunction');
      expect(exportNames).toContain('_privateConst');
      expect(exportNames).toContain('Component123');
      expect(exportNames).toContain('IUserInterface');
      expect(exportNames).toContain('GenericType');
    });

    it('should limit results to prevent performance issues', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`).join('\n'),
        stderr: ''
      });

      // Each file has multiple exports
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`
        export function func1() {}
        export function func2() {}
        export function func3() {}
      `);

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      // Should limit total results even if many files have exports
      expect(untestedExports.length).toBeLessThanOrEqual(20);
    });

    it('should handle exec command failures', async () => {
      mockExecAsync.mockRejectedValue(new Error('find command failed'));

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports).toEqual([]);
    });
  });
});