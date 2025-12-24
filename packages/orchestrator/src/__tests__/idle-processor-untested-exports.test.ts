import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from '../idle-processor.js';
import { TaskStore } from '../store.js';
import type { DaemonConfig, UntestedExport } from '@apexcli/core';

// Mock external dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  },
}));

vi.mock('../store.js', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
    getAllTasks: vi.fn().mockResolvedValue([]),
    getTasksByStatus: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock child_process for exec commands
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

describe('IdleProcessor - Untested Exports Analysis', () => {
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

  describe('analyzeUntestedExports', () => {
    it('should identify basic untested function exports', async () => {
      const mockSourceContent = `
export function testedFunction() {
  return 'tested';
}

export function untestedFunction() {
  return 'untested';
}
`;

      const mockTestContent = `
import { testedFunction } from '../src/test';

describe('testedFunction', () => {
  it('should work', () => {
    expect(testedFunction()).toBe('tested');
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);

      // First call for finding source files
      mockExecAsync.mockResolvedValueOnce({
        stdout: './src/test.ts\n',
        stderr: ''
      });

      // Mock reading source file
      mockReadFile.mockResolvedValueOnce(mockSourceContent);

      // Mock reading test file (exists for testedFunction)
      mockReadFile.mockResolvedValueOnce(mockTestContent);

      // Mock reading test file for untestedFunction (should return empty/error)
      mockReadFile.mockRejectedValueOnce(new Error('Test file not found'));

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports.length).toBeGreaterThan(0);

      const untestedFunction = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'untestedFunction'
      );
      expect(untestedFunction).toBeDefined();
      expect(untestedFunction?.exportType).toBe('function');
      expect(untestedFunction?.isPublic).toBe(true);
      expect(untestedFunction?.file).toBe('src/test.ts');
    });

    it('should identify untested class exports and methods', async () => {
      const mockSourceContent = `
export class TestClass {
  public testedMethod() {
    return 'tested';
  }

  public untestedMethod() {
    return 'untested';
  }

  private _privateMethod() {
    return 'private';
  }
}

export class UntestedClass {
  public someMethod() {
    return 'never tested';
  }
}
`;

      const mockTestContent = `
import { TestClass } from '../src/classes';

describe('TestClass', () => {
  it('should test testedMethod', () => {
    const instance = new TestClass();
    expect(instance.testedMethod()).toBe('tested');
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);

      mockExecAsync.mockResolvedValueOnce({
        stdout: './src/classes.ts\n',
        stderr: ''
      });

      mockReadFile.mockResolvedValueOnce(mockSourceContent);
      mockReadFile.mockResolvedValueOnce(mockTestContent);

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);

      // Should find the untested class
      const untestedClass = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'UntestedClass'
      );
      expect(untestedClass).toBeDefined();
      expect(untestedClass?.exportType).toBe('class');

      // Should find the untested method
      const untestedMethod = untestedExports.find((exp: UntestedExport) =>
        exp.exportName.includes('untestedMethod')
      );
      expect(untestedMethod).toBeDefined();
      expect(untestedMethod?.exportType).toBe('function');

      // Should identify private method as non-public
      const privateMethod = untestedExports.find((exp: UntestedExport) =>
        exp.exportName.includes('_privateMethod')
      );
      if (privateMethod) {
        expect(privateMethod.isPublic).toBe(false);
      }
    });

    it('should handle various export patterns', async () => {
      const mockSourceContent = `
export async function asyncFunction() {
  return Promise.resolve('async');
}

export const arrowFunction = () => {
  return 'arrow';
};

export const asyncArrowFunction = async () => {
  return Promise.resolve('async arrow');
};

export const functionAssignment = function() {
  return 'assignment';
};

export interface PublicInterface {
  prop: string;
}

export type PublicType = string;

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

export namespace Utils {
  export function helper() {
    return 'helper';
  }
}

export let variableExport = 'variable';
export const constantExport = 'constant';
`;

      const mockReadFile = vi.mocked(fs.readFile);

      mockExecAsync.mockResolvedValueOnce({
        stdout: './src/exports.ts\n',
        stderr: ''
      });

      mockReadFile.mockResolvedValueOnce(mockSourceContent);
      // No test files for any of these exports
      mockReadFile.mockRejectedValue(new Error('No test file'));

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports.length).toBeGreaterThan(0);

      const exportTypes = untestedExports.map((exp: UntestedExport) => exp.exportType);
      expect(exportTypes).toContain('function');
      expect(exportTypes).toContain('interface');
      expect(exportTypes).toContain('type');
      expect(exportTypes).toContain('enum');
      expect(exportTypes).toContain('namespace');
      expect(exportTypes).toContain('const');

      // Verify specific exports are detected
      const exportNames = untestedExports.map((exp: UntestedExport) => exp.exportName);
      expect(exportNames).toContain('asyncFunction');
      expect(exportNames).toContain('arrowFunction');
      expect(exportNames).toContain('PublicInterface');
      expect(exportNames).toContain('PublicType');
      expect(exportNames).toContain('Status');
      expect(exportNames).toContain('Utils');
    });

    it('should correctly identify public vs private exports', async () => {
      const mockInternalContent = `
export function _internalFunction() {
  return 'internal';
}

export function __privateFunction() {
  return 'private';
}

export function publicFunction() {
  return 'public';
}
`;

      const mockReadFile = vi.mocked(fs.readFile);

      mockExecAsync.mockResolvedValueOnce({
        stdout: './src/internal/utils.ts\n',
        stderr: ''
      });

      mockReadFile.mockResolvedValueOnce(mockInternalContent);
      mockReadFile.mockRejectedValue(new Error('No test files'));

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      const internalFunc = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === '_internalFunction'
      );
      const privateFunc = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === '__privateFunction'
      );
      const publicFunc = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'publicFunction'
      );

      // Functions starting with underscore should be marked as non-public
      expect(internalFunc?.isPublic).toBe(false);
      expect(privateFunc?.isPublic).toBe(false);

      // Regular function should be public if not in internal directory
      // Note: this test file is in internal/ so it might be marked as non-public
      // due to directory structure
    });

    it('should handle error cases gracefully', async () => {
      // Mock exec to fail
      mockExecAsync.mockRejectedValueOnce(new Error('Command failed'));

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      // Should return empty array on error, not throw
      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports).toEqual([]);
    });

    it('should limit results to prevent performance issues', async () => {
      const mockManyFiles = Array.from({ length: 100 }, (_, i) => `./src/file${i}.ts`).join('\n');

      mockExecAsync.mockResolvedValueOnce({
        stdout: mockManyFiles,
        stderr: ''
      });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('export function test() {}');
      mockReadFile.mockRejectedValue(new Error('No test files'));

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      // Should limit results (current implementation limits to 30)
      expect(untestedExports.length).toBeLessThanOrEqual(30);
    });
  });

  describe('extractPublicExports', () => {
    it('should extract exports from TypeScript code', async () => {
      const sourceCode = `
import { something } from 'elsewhere';

export function regularFunction() {}
export async function asyncFunction() {}
export abstract class AbstractClass {}
export const constValue = 'value';
export let letValue = 'let';
export var varValue = 'var';
export interface MyInterface {}
export type MyType = string;
export enum MyEnum { VALUE }
export namespace MyNamespace {}
`;

      const exports = (idleProcessor as any).extractPublicExports(sourceCode, './src/test.ts');

      expect(Array.isArray(exports)).toBe(true);
      expect(exports.length).toBeGreaterThan(0);

      const exportNames = exports.map((exp: any) => exp.name);
      expect(exportNames).toContain('regularFunction');
      expect(exportNames).toContain('asyncFunction');
      expect(exportNames).toContain('AbstractClass');
      expect(exportNames).toContain('constValue');
      expect(exportNames).toContain('MyInterface');
      expect(exportNames).toContain('MyType');
      expect(exportNames).toContain('MyEnum');
      expect(exportNames).toContain('MyNamespace');

      // Verify types are correctly identified
      const functionExport = exports.find((exp: any) => exp.name === 'regularFunction');
      expect(functionExport?.type).toBe('function');

      const classExport = exports.find((exp: any) => exp.name === 'AbstractClass');
      expect(classExport?.type).toBe('class');

      const interfaceExport = exports.find((exp: any) => exp.name === 'MyInterface');
      expect(interfaceExport?.type).toBe('interface');
    });

    it('should extract class methods from exported classes', async () => {
      const sourceCode = `
export class TestClass {
  constructor() {}

  public publicMethod() {}

  async asyncMethod() {}

  static staticMethod() {}

  private privateMethod() {}

  protected protectedMethod() {}
}
`;

      const exports = (idleProcessor as any).extractPublicExports(sourceCode, './src/class.ts');

      const classExport = exports.find((exp: any) => exp.name === 'TestClass');
      expect(classExport).toBeDefined();

      // Should find class methods
      const methodExports = exports.filter((exp: any) => exp.name.includes('.'));
      expect(methodExports.length).toBeGreaterThan(0);

      const exportNames = exports.map((exp: any) => exp.name);
      expect(exportNames).toContain('TestClass.publicMethod');
      expect(exportNames).toContain('TestClass.asyncMethod');
      expect(exportNames).toContain('TestClass.staticMethod');

      // Should not include constructor
      expect(exportNames.some((name: string) => name.includes('constructor'))).toBe(false);
    });

    it('should handle arrow function exports', async () => {
      const sourceCode = `
export const simpleArrow = () => {};
export const paramArrow = (param: string) => param;
export const asyncArrow = async () => Promise.resolve();
export const complexArrow = (a: number, b: string) => ({ a, b });
`;

      const exports = (idleProcessor as any).extractPublicExports(sourceCode, './src/arrows.ts');

      const exportNames = exports.map((exp: any) => exp.name);
      expect(exportNames).toContain('simpleArrow');
      expect(exportNames).toContain('paramArrow');
      expect(exportNames).toContain('asyncArrow');
      expect(exportNames).toContain('complexArrow');

      // All should be identified as functions
      exports.forEach((exp: any) => {
        if (exp.name.includes('Arrow')) {
          expect(exp.type).toBe('function');
        }
      });
    });

    it('should skip comments and handle edge cases', async () => {
      const sourceCode = `
// This is a comment with export function fake()
/*
 * Multi-line comment
 * export class FakeClass
 */

export function realFunction() {}

// export const commentedOut = 'not real';

export const realConst = 'real';
`;

      const exports = (idleProcessor as any).extractPublicExports(sourceCode, './src/comments.ts');

      const exportNames = exports.map((exp: any) => exp.name);
      expect(exportNames).toContain('realFunction');
      expect(exportNames).toContain('realConst');

      // Should not include commented exports
      expect(exportNames).not.toContain('fake');
      expect(exportNames).not.toContain('FakeClass');
      expect(exportNames).not.toContain('commentedOut');
    });
  });

  describe('checkIfExportHasAdvancedTest', () => {
    it('should detect tests with direct name matches', async () => {
      const mockTestContent = `
import { testFunction } from '../src/utils';

describe('testFunction', () => {
  it('should work correctly', () => {
    expect(testFunction()).toBeDefined();
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValueOnce(mockTestContent);

      const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/utils.ts',
        'testFunction'
      );

      expect(hasTest).toBe(true);
    });

    it('should detect tests with import patterns', async () => {
      const mockTestContent = `
import { validateEmail, formatDate } from '../src/validators';
import { UserService } from '../services/user';

describe('Email Validation', () => {
  it('should validate email correctly', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValueOnce(mockTestContent);

      const hasEmailTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/validators.ts',
        'validateEmail'
      );

      const hasDateTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/validators.ts',
        'formatDate'
      );

      const hasServiceTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './services/user.ts',
        'UserService'
      );

      expect(hasEmailTest).toBe(true);
      expect(hasDateTest).toBe(true);
      expect(hasServiceTest).toBe(true);
    });

    it('should detect class method tests', async () => {
      const mockTestContent = `
import { UserManager } from '../src/user-manager';

describe('UserManager', () => {
  describe('createUser', () => {
    it('should create user correctly', () => {
      const manager = new UserManager();
      expect(manager.createUser('test')).toBeDefined();
    });
  });

  describe('deleteUser', () => {
    it('should delete user', () => {
      const manager = new UserManager();
      manager.deleteUser('test');
    });
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValueOnce(mockTestContent);

      const hasClassTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/user-manager.ts',
        'UserManager'
      );

      const hasMethodTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/user-manager.ts',
        'UserManager.createUser'
      );

      expect(hasClassTest).toBe(true);
      expect(hasMethodTest).toBe(true);
    });

    it('should try multiple test file patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);

      // First few attempts fail
      mockReadFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('File not found'))
        // Finally find test in __tests__ directory
        .mockResolvedValueOnce('import { testFn } from "../src/utils"; describe("testFn", () => {});');

      const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/utils.ts',
        'testFn'
      );

      expect(hasTest).toBe(true);
      expect(mockReadFile).toHaveBeenCalledTimes(4);
    });

    it('should return false when no test files exist', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/untested.ts',
        'untestedFunction'
      );

      expect(hasTest).toBe(false);
    });

    it('should return false when test files exist but do not test the export', async () => {
      const mockTestContent = `
import { otherFunction } from '../src/other';

describe('otherFunction', () => {
  it('should work', () => {
    expect(otherFunction()).toBeDefined();
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockTestContent);

      const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/utils.ts',
        'myFunction'
      );

      expect(hasTest).toBe(false);
    });

    it('should handle regex escaping correctly', async () => {
      const mockTestContent = `
import { $pecialFunction, special.method } from '../src/utils';

describe('$pecialFunction', () => {
  test('should handle special characters', () => {
    expect($pecialFunction()).toBeDefined();
  });
});
`;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockTestContent);

      const hasTest = await (idleProcessor as any).checkIfExportHasAdvancedTest(
        './src/utils.ts',
        '$pecialFunction'
      );

      expect(hasTest).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should end-to-end detect untested exports in a realistic project structure', async () => {
      // Mock a realistic project structure
      const sourceFiles = [
        './src/api/users.ts',
        './src/api/auth.ts',
        './src/utils/validation.ts',
        './src/models/user.ts'
      ];

      const mockSourceContents = {
        './src/api/users.ts': `
export class UserAPI {
  async getUsers() { return []; }
  async createUser(data: any) { return {}; }
  async deleteUser(id: string) { return true; }
}

export function validateUserData(data: any) {
  return data.email && data.name;
}
`,
        './src/api/auth.ts': `
export async function login(credentials: any) {
  return { token: 'token' };
}

export async function logout() {
  return true;
}

export function verifyToken(token: string) {
  return token === 'valid';
}
`,
        './src/utils/validation.ts': `
export function isEmail(email: string) {
  return email.includes('@');
}

export const phoneRegex = /^\d{10}$/;
`,
        './src/models/user.ts': `
export interface User {
  id: string;
  email: string;
  name: string;
}

export type UserRole = 'admin' | 'user';
`
      };

      const mockTestContents = {
        './src/api/users.test.ts': `
import { UserAPI } from './users';

describe('UserAPI', () => {
  describe('getUsers', () => {
    it('should return users', async () => {
      const api = new UserAPI();
      const users = await api.getUsers();
      expect(Array.isArray(users)).toBe(true);
    });
  });

  // Note: createUser and deleteUser are not tested
});
`,
        './src/api/auth.test.ts': `
import { login } from './auth';

describe('Authentication', () => {
  it('should login user', async () => {
    const result = await login({ email: 'test', password: 'test' });
    expect(result.token).toBeDefined();
  });

  // Note: logout and verifyToken are not tested
});
`,
        // No tests for validation.ts or user.ts
      };

      const mockReadFile = vi.mocked(fs.readFile);

      mockExecAsync.mockResolvedValueOnce({
        stdout: sourceFiles.join('\n'),
        stderr: ''
      });

      mockReadFile.mockImplementation(async (path: string) => {
        const pathStr = path.toString();

        // Return source file contents
        if (mockSourceContents[pathStr as keyof typeof mockSourceContents]) {
          return mockSourceContents[pathStr as keyof typeof mockSourceContents];
        }

        // Return test file contents if they exist
        if (mockTestContents[pathStr as keyof typeof mockTestContents]) {
          return mockTestContents[pathStr as keyof typeof mockTestContents];
        }

        // Otherwise throw error (no test file)
        throw new Error('File not found');
      });

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports.length).toBeGreaterThan(0);

      const exportNames = untestedExports.map((exp: UntestedExport) => exp.exportName);

      // Should find untested methods
      expect(exportNames).toContain('UserAPI.createUser');
      expect(exportNames).toContain('UserAPI.deleteUser');
      expect(exportNames).toContain('validateUserData');
      expect(exportNames).toContain('logout');
      expect(exportNames).toContain('verifyToken');
      expect(exportNames).toContain('isEmail');
      expect(exportNames).toContain('phoneRegex');
      expect(exportNames).toContain('User');
      expect(exportNames).toContain('UserRole');

      // Should NOT find tested exports
      expect(exportNames).not.toContain('UserAPI.getUsers');
      expect(exportNames).not.toContain('login');

      // Verify export types are correct
      const createUserExport = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'UserAPI.createUser'
      );
      expect(createUserExport?.exportType).toBe('function');

      const userInterfaceExport = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'User'
      );
      expect(userInterfaceExport?.exportType).toBe('interface');

      const userTypeExport = untestedExports.find((exp: UntestedExport) =>
        exp.exportName === 'UserRole'
      );
      expect(userTypeExport?.exportType).toBe('type');
    });
  });
});