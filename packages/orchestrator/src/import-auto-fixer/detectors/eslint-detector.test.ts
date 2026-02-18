/**
 * ESLint Detector Unit Tests
 *
 * Tests the ESLint-based missing import detection functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ESLintDetector } from './eslint-detector';
import type { MissingImport } from '../types';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process');
const mockSpawn = vi.mocked(spawn);

describe('ESLintDetector', () => {
  let detector: ESLintDetector;

  beforeEach(() => {
    detector = new ESLintDetector({ cwd: '/test/project' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create detector with default options', () => {
      const defaultDetector = new ESLintDetector();
      expect(defaultDetector.id).toBe('eslint');
      expect(defaultDetector.name).toBe('ESLint Detector');
    });

    it('should create detector with custom cwd', () => {
      const customDetector = new ESLintDetector({ cwd: '/custom/path' });
      expect(customDetector.id).toBe('eslint');
    });
  });

  describe('isAvailable()', () => {
    it('should return true when ESLint is available', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.isAvailable();

      // Simulate successful ESLint execution
      setTimeout(() => {
        mockProcess.stdout.emit('data', '{"version":"8.0.0"}');
        mockProcess.emit('close', 0);
      }, 10);

      const isAvailable = await promise;
      expect(isAvailable).toBe(true);
    });

    it('should return false when ESLint is not available', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.isAvailable();

      // Simulate ESLint not found
      setTimeout(() => {
        mockProcess.emit('error', new Error('ENOENT: eslint not found'));
      }, 10);

      const isAvailable = await promise;
      expect(isAvailable).toBe(false);
    });

    it('should return false when ESLint exits with error code', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.isAvailable();

      // Simulate ESLint exit with error
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'ESLint configuration error');
        mockProcess.emit('close', 1);
      }, 10);

      const isAvailable = await promise;
      expect(isAvailable).toBe(false);
    });
  });

  describe('detect()', () => {
    const testFilePath = '/test/project/src/test.ts';
    const testContent = `
function Component() {
  const data = _.map([1, 2, 3], x => x * 2);
  const formatted = formatNumber(42);
  return <div>{data.length}</div>;
}`;

    it('should detect missing imports from ESLint output', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect(testFilePath, testContent);

      // Simulate ESLint output with missing import errors
      const eslintOutput = JSON.stringify([{
        filePath: testFilePath,
        messages: [
          {
            ruleId: 'import/no-unresolved',
            severity: 2,
            message: "'_' is not defined.",
            line: 3,
            column: 15,
            nodeType: 'Identifier',
            source: '_'
          },
          {
            ruleId: 'no-undef',
            severity: 2,
            message: "'formatNumber' is not defined.",
            line: 4,
            column: 19,
            nodeType: 'Identifier',
            source: 'formatNumber'
          }
        ]
      }]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', eslintOutput);
        mockProcess.emit('close', 0);
      }, 10);

      const missingImports = await promise;

      expect(missingImports).toHaveLength(2);

      const lodashImport = missingImports.find(imp => imp.identifier === '_');
      expect(lodashImport).toBeDefined();
      expect(lodashImport!.line).toBe(3);
      expect(lodashImport!.column).toBe(15);

      const formatNumberImport = missingImports.find(imp => imp.identifier === 'formatNumber');
      expect(formatNumberImport).toBeDefined();
      expect(formatNumberImport!.line).toBe(4);
      expect(formatNumberImport!.column).toBe(19);
    });

    it('should handle empty ESLint output', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect(testFilePath, testContent);

      setTimeout(() => {
        mockProcess.stdout.emit('data', '[]');
        mockProcess.emit('close', 0);
      }, 10);

      const missingImports = await promise;
      expect(missingImports).toHaveLength(0);
    });

    it('should handle malformed ESLint output', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect(testFilePath, testContent);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'invalid json');
        mockProcess.emit('close', 0);
      }, 10);

      const missingImports = await promise;
      expect(missingImports).toHaveLength(0);
    });

    it('should handle ESLint process errors', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect(testFilePath, testContent);

      setTimeout(() => {
        mockProcess.emit('error', new Error('Process failed'));
      }, 10);

      const missingImports = await promise;
      expect(missingImports).toHaveLength(0);
    });

    it('should filter relevant missing import rules', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect(testFilePath, testContent);

      // ESLint output with mix of relevant and irrelevant errors
      const eslintOutput = JSON.stringify([{
        filePath: testFilePath,
        messages: [
          {
            ruleId: 'no-undef',
            severity: 2,
            message: "'React' is not defined.",
            line: 1,
            column: 1,
            nodeType: 'Identifier',
            source: 'React'
          },
          {
            ruleId: 'prefer-const',
            severity: 1,
            message: "'data' is never reassigned.",
            line: 3,
            column: 9,
            nodeType: 'Identifier'
          },
          {
            ruleId: 'import/no-unresolved',
            severity: 2,
            message: "'unknown-package' is not resolved.",
            line: 2,
            column: 1,
            nodeType: 'ImportDeclaration',
            source: 'unknown-package'
          }
        ]
      }]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', eslintOutput);
        mockProcess.emit('close', 0);
      }, 10);

      const missingImports = await promise;

      // Should only include import-related errors, not style/preference errors
      expect(missingImports).toHaveLength(1);
      expect(missingImports[0].identifier).toBe('React');
    });

    it('should detect TypeScript-specific missing imports', async () => {
      const tsContent = `
interface User {
  id: number;
  name: string;
}

function processUser(user: UnknownType): ReactElement {
  return <UserComponent user={user} />;
}`;

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect('/test/project/src/test.tsx', tsContent);

      const eslintOutput = JSON.stringify([{
        filePath: '/test/project/src/test.tsx',
        messages: [
          {
            ruleId: '@typescript-eslint/no-undef',
            severity: 2,
            message: "'UnknownType' is not defined.",
            line: 7,
            column: 21,
            nodeType: 'TSTypeReference',
            source: 'UnknownType'
          },
          {
            ruleId: '@typescript-eslint/no-undef',
            severity: 2,
            message: "'ReactElement' is not defined.",
            line: 7,
            column: 36,
            nodeType: 'TSTypeReference',
            source: 'ReactElement'
          }
        ]
      }]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', eslintOutput);
        mockProcess.emit('close', 0);
      }, 10);

      const missingImports = await promise;

      expect(missingImports).toHaveLength(2);

      const typeImports = missingImports.filter(imp => imp.isTypeOnly);
      expect(typeImports).toHaveLength(2);
    });

    it('should detect usage context correctly', async () => {
      const contextContent = `
function test() {
  const result = someFunction(arg1, arg2);
  const instance = new SomeClass();
  const value = SomeObject.property;
  return <SomeComponent prop={value} />;
}`;

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockProcess);

      const promise = detector.detect(testFilePath, contextContent);

      const eslintOutput = JSON.stringify([{
        filePath: testFilePath,
        messages: [
          {
            ruleId: 'no-undef',
            severity: 2,
            message: "'someFunction' is not defined.",
            line: 3,
            column: 17,
            nodeType: 'Identifier',
            source: 'someFunction'
          },
          {
            ruleId: 'no-undef',
            severity: 2,
            message: "'SomeClass' is not defined.",
            line: 4,
            column: 21,
            nodeType: 'Identifier',
            source: 'SomeClass'
          },
          {
            ruleId: 'no-undef',
            severity: 2,
            message: "'SomeComponent' is not defined.",
            line: 6,
            column: 11,
            nodeType: 'JSXIdentifier',
            source: 'SomeComponent'
          }
        ]
      }]);

      setTimeout(() => {
        mockProcess.stdout.emit('data', eslintOutput);
        mockProcess.emit('close', 0);
      }, 10);

      const missingImports = await promise;

      expect(missingImports).toHaveLength(3);

      const functionCall = missingImports.find(imp => imp.identifier === 'someFunction');
      expect(functionCall?.context?.isFunctionCall).toBe(true);

      const constructorCall = missingImports.find(imp => imp.identifier === 'SomeClass');
      expect(constructorCall?.context?.isConstructor).toBe(true);

      const jsxComponent = missingImports.find(imp => imp.identifier === 'SomeComponent');
      expect(jsxComponent?.context?.usageType).toBe('jsx');
    });
  });
});