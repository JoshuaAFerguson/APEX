/**
 * End-to-end TDD workflow tests
 *
 * This test suite covers:
 * - Complete TDD workflows from start to finish
 * - Real-world scenarios with multiple test frameworks
 * - Integration with different project structures
 * - Performance under realistic conditions
 * - Error scenarios and recovery
 * - Metrics and reporting
 *
 * @module tdd-executor-e2e.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import {
  TDDExecutor,
  executeTDD,
  type TDDExecutorConfig,
  type TDDExecutionResult,
} from './tdd-executor';
import type {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
} from '@apexcli/core';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');
vi.mock('@anthropic-ai/claude-agent-sdk');

const mockExec = exec as unknown as Mock;
const mockFs = {
  readFile: vi.mocked(fs.readFile),
  writeFile: vi.mocked(fs.writeFile),
  mkdir: vi.mocked(fs.mkdir),
  access: vi.mocked(fs.access),
  stat: vi.mocked(fs.stat),
  readdir: vi.mocked(fs.readdir),
};
const mockQuery = vi.mocked(query);

// Mock test scenarios
const TEST_SCENARIOS = {
  simpleCalculator: {
    initialFiles: {
      'src/calculator.ts': '',
      'src/calculator.test.ts': `
import { Calculator } from './calculator';

describe('Calculator', () => {
  test('should add two numbers', () => {
    const calc = new Calculator();
    expect(calc.add(2, 3)).toBe(5);
  });

  test('should multiply two numbers', () => {
    const calc = new Calculator();
    expect(calc.multiply(4, 5)).toBe(20);
  });
});
      `,
    },
    testOutputs: [
      {
        stdout: '',
        stderr: `
FAIL src/calculator.test.ts
  × should add two numbers
    TypeError: Calculator is not a constructor
      at Object.<anonymous> (src/calculator.test.ts:4:18)
        `,
        exitCode: 1,
      },
      {
        stdout: '',
        stderr: `
FAIL src/calculator.test.ts
  × should add two numbers
    TypeError: calc.add is not a function
      at Object.<anonymous> (src/calculator.test.ts:5:23)
        `,
        exitCode: 1,
      },
      {
        stdout: '',
        stderr: `
FAIL src/calculator.test.ts
  × should multiply two numbers
    TypeError: calc.multiply is not a function
      at Object.<anonymous> (src/calculator.test.ts:10:23)
        `,
        exitCode: 1,
      },
      {
        stdout: '✓ All tests passed',
        stderr: '',
        exitCode: 0,
      },
    ],
    fixes: [
      {
        description: 'Create Calculator class',
        file: 'src/calculator.ts',
        originalContent: '',
        newContent: 'export class Calculator {\n}',
        confidence: 0.9,
      },
      {
        description: 'Add add method to Calculator',
        file: 'src/calculator.ts',
        originalContent: 'export class Calculator {\n}',
        newContent: 'export class Calculator {\n  add(a: number, b: number): number {\n    return a + b;\n  }\n}',
        confidence: 0.95,
      },
      {
        description: 'Add multiply method to Calculator',
        file: 'src/calculator.ts',
        originalContent: 'export class Calculator {\n  add(a: number, b: number): number {\n    return a + b;\n  }\n}',
        newContent: 'export class Calculator {\n  add(a: number, b: number): number {\n    return a + b;\n  }\n  multiply(a: number, b: number): number {\n    return a * b;\n  }\n}',
        confidence: 0.95,
      },
    ],
  },
  complexUserService: {
    initialFiles: {
      'src/user.ts': '',
      'src/database.ts': 'export interface Database {\n  save(data: any): Promise<void>;\n  findById(id: string): Promise<any>;\n}',
      'src/user.test.ts': `
import { UserService } from './user';
import { Database } from './database';

describe('UserService', () => {
  let userService: UserService;
  let mockDatabase: Database;

  beforeEach(() => {
    mockDatabase = {
      save: jest.fn(),
      findById: jest.fn(),
    };
    userService = new UserService(mockDatabase);
  });

  test('should create user with valid data', async () => {
    const userData = { name: 'John', email: 'john@example.com' };
    const result = await userService.createUser(userData);

    expect(result).toHaveProperty('id');
    expect(result.name).toBe('John');
    expect(mockDatabase.save).toHaveBeenCalledWith(expect.objectContaining(userData));
  });

  test('should throw error for invalid email', async () => {
    const userData = { name: 'John', email: 'invalid-email' };

    await expect(userService.createUser(userData)).rejects.toThrow('Invalid email format');
  });

  test('should find user by id', async () => {
    const userId = '123';
    const userData = { id: userId, name: 'John', email: 'john@example.com' };

    (mockDatabase.findById as jest.Mock).mockResolvedValue(userData);

    const result = await userService.findUser(userId);
    expect(result).toEqual(userData);
    expect(mockDatabase.findById).toHaveBeenCalledWith(userId);
  });
});
      `,
    },
    testOutputs: [
      {
        stdout: '',
        stderr: `
FAIL src/user.test.ts
  × should create user with valid data
    Cannot find module './user' or its type declarations.
        `,
        exitCode: 1,
      },
      {
        stdout: '',
        stderr: `
FAIL src/user.test.ts
  × should create user with valid data
    TypeError: UserService is not a constructor
        `,
        exitCode: 1,
      },
      {
        stdout: '',
        stderr: `
FAIL src/user.test.ts
  × should create user with valid data
    TypeError: userService.createUser is not a function
        `,
        exitCode: 1,
      },
      {
        stdout: '',
        stderr: `
FAIL src/user.test.ts
  × should throw error for invalid email
    Error: Invalid email format
    Expected to throw but did not receive any error
        `,
        exitCode: 1,
      },
      {
        stdout: '',
        stderr: `
FAIL src/user.test.ts
  × should find user by id
    TypeError: userService.findUser is not a function
        `,
        exitCode: 1,
      },
      {
        stdout: '✓ All tests passed (3)',
        stderr: '',
        exitCode: 0,
      },
    ],
    fixes: [
      {
        description: 'Create UserService module',
        file: 'src/user.ts',
        originalContent: '',
        newContent: 'export class UserService {\n}',
        confidence: 0.8,
      },
      {
        description: 'Add constructor to UserService',
        file: 'src/user.ts',
        originalContent: 'export class UserService {\n}',
        newContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n}',
        confidence: 0.9,
      },
      {
        description: 'Add createUser method',
        file: 'src/user.ts',
        originalContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n}',
        newContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n\n  async createUser(userData: { name: string; email: string }) {\n    const user = { id: Math.random().toString(36), ...userData };\n    await this.database.save(user);\n    return user;\n  }\n}',
        confidence: 0.85,
      },
      {
        description: 'Add email validation to createUser',
        file: 'src/user.ts',
        originalContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n\n  async createUser(userData: { name: string; email: string }) {\n    const user = { id: Math.random().toString(36), ...userData };\n    await this.database.save(user);\n    return user;\n  }\n}',
        newContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n\n  async createUser(userData: { name: string; email: string }) {\n    if (!this.isValidEmail(userData.email)) {\n      throw new Error(\'Invalid email format\');\n    }\n    const user = { id: Math.random().toString(36), ...userData };\n    await this.database.save(user);\n    return user;\n  }\n\n  private isValidEmail(email: string): boolean {\n    return email.includes(\'@\') && email.includes(\'.\');\n  }\n}',
        confidence: 0.9,
      },
      {
        description: 'Add findUser method',
        file: 'src/user.ts',
        originalContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n\n  async createUser(userData: { name: string; email: string }) {\n    if (!this.isValidEmail(userData.email)) {\n      throw new Error(\'Invalid email format\');\n    }\n    const user = { id: Math.random().toString(36), ...userData };\n    await this.database.save(user);\n    return user;\n  }\n\n  private isValidEmail(email: string): boolean {\n    return email.includes(\'@\') && email.includes(\'.\');\n  }\n}',
        newContent: 'import { Database } from \'./database\';\n\nexport class UserService {\n  constructor(private database: Database) {}\n\n  async createUser(userData: { name: string; email: string }) {\n    if (!this.isValidEmail(userData.email)) {\n      throw new Error(\'Invalid email format\');\n    }\n    const user = { id: Math.random().toString(36), ...userData };\n    await this.database.save(user);\n    return user;\n  }\n\n  async findUser(id: string) {\n    return await this.database.findById(id);\n  }\n\n  private isValidEmail(email: string): boolean {\n    return email.includes(\'@\') && email.includes(\'.\');\n  }\n}',
        confidence: 0.95,
      },
    ],
  },
};

describe('TDD Executor End-to-End', () => {
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let config: ApexConfig;
  let agents: Record<string, AgentDefinition>;
  let workflows: Record<string, WorkflowDefinition>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test database
    taskStore = new TaskStore(':memory:');

    // Configure test environment
    config = {
      maxConcurrentTasks: 1,
      agents: {
        developer: {
          name: 'developer',
          role: 'Software Developer',
          description: 'Expert TypeScript developer following TDD practices',
          instructions: 'Write clean, testable code. Follow TypeScript best practices. Implement exactly what the tests require.',
        },
      },
      workflows: {
        tdd: {
          name: 'tdd',
          description: 'Test-driven development workflow',
          stages: [
            { name: 'test', agent: 'developer' },
            { name: 'implement', agent: 'developer' },
          ],
        },
      },
      tdd: {
        enabled: true,
        maxIterations: 10,
        testCommand: 'npm test',
        timeout: 30000,
      },
      permissions: {
        allowedTools: ['*'],
        restrictedPaths: [],
        dangerous: { enabled: false },
      },
      limits: {
        maxTokensPerRequest: 100000,
        maxRequestsPerHour: 1000,
        maxConcurrentRequests: 10,
      },
    };

    agents = config.agents;
    workflows = config.workflows;

    // Mock file system
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readdir.mockResolvedValue([]);

    orchestrator = new ApexOrchestrator(
      taskStore,
      config,
      agents,
      workflows,
      '.test-apex',
      '/test/project'
    );

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
    if (taskStore) {
      taskStore.close();
    }
    vi.restoreAllMocks();
  });

  describe('Simple Calculator TDD Workflow', () => {
    it('should implement calculator through TDD iterations', async () => {
      const scenario = TEST_SCENARIOS.simpleCalculator;
      let currentFileContent = scenario.initialFiles['src/calculator.ts'];
      let testCallCount = 0;
      let fixCallCount = 0;

      // Mock test execution progression
      mockExec.mockImplementation((command, options, callback) => {
        const testOutput = scenario.testOutputs[testCallCount];
        testCallCount++;

        if (testOutput.exitCode === 0) {
          if (callback) {
            callback(null, { stdout: testOutput.stdout, stderr: testOutput.stderr });
          }
        } else {
          const error = new Error('Tests failed');
          (error as any).code = testOutput.exitCode;
          (error as any).stdout = testOutput.stdout;
          (error as any).stderr = testOutput.stderr;
          if (callback) callback(error);
        }
        return {};
      });

      // Mock Claude fix generation
      mockQuery.mockImplementation(async () => {
        const fix = scenario.fixes[fixCallCount];
        fixCallCount++;
        return {
          content: JSON.stringify({
            description: fix.description,
            file: fix.file,
            originalContent: fix.originalContent,
            newContent: fix.newContent,
            confidence: fix.confidence,
            reasoning: `Generated fix ${fixCallCount} for calculator implementation`,
          }),
        };
      });

      // Mock file operations
      mockFs.readFile.mockImplementation(async (filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.endsWith('calculator.ts')) {
          return currentFileContent;
        }
        return scenario.initialFiles[path.basename(pathStr)] || '';
      });

      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        if (filePath.toString().endsWith('calculator.ts')) {
          currentFileContent = content as string;
        }
      });

      const tddExecutor = (orchestrator as any).tddExecutor;
      const result: TDDExecutionResult = await tddExecutor.execute('calculator-e2e');

      // Verify successful completion
      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(4);
      expect(result.iterations).toHaveLength(4);

      // Verify progression through iterations
      expect(result.iterations[0].testResult.success).toBe(false);
      expect(result.iterations[0].suggestedFix?.description).toContain('Calculator class');

      expect(result.iterations[1].testResult.success).toBe(false);
      expect(result.iterations[1].suggestedFix?.description).toContain('add method');

      expect(result.iterations[2].testResult.success).toBe(false);
      expect(result.iterations[2].suggestedFix?.description).toContain('multiply method');

      expect(result.iterations[3].testResult.success).toBe(true);
      expect(result.iterations[3].resolved).toBe(true);

      // Verify final file content
      expect(currentFileContent).toContain('export class Calculator');
      expect(currentFileContent).toContain('add(a: number, b: number)');
      expect(currentFileContent).toContain('multiply(a: number, b: number)');
    });
  });

  describe('Complex User Service TDD Workflow', () => {
    it('should implement user service with validation and database integration', async () => {
      const scenario = TEST_SCENARIOS.complexUserService;
      const fileContents: Record<string, string> = { ...scenario.initialFiles };
      let testCallCount = 0;
      let fixCallCount = 0;

      // Mock test execution with complex scenarios
      mockExec.mockImplementation((command, options, callback) => {
        const testOutput = scenario.testOutputs[testCallCount];
        testCallCount++;

        if (testOutput.exitCode === 0) {
          if (callback) {
            callback(null, { stdout: testOutput.stdout, stderr: testOutput.stderr });
          }
        } else {
          const error = new Error('Tests failed');
          (error as any).code = testOutput.exitCode;
          (error as any).stdout = testOutput.stdout;
          (error as any).stderr = testOutput.stderr;
          if (callback) callback(error);
        }
        return {};
      });

      // Mock Claude with complex reasoning
      mockQuery.mockImplementation(async () => {
        const fix = scenario.fixes[fixCallCount];
        fixCallCount++;
        return {
          content: JSON.stringify({
            description: fix.description,
            file: fix.file,
            originalContent: fix.originalContent,
            newContent: fix.newContent,
            confidence: fix.confidence,
            reasoning: `Step ${fixCallCount}: ${fix.description}. This addresses the current test failure by implementing the missing functionality with proper TypeScript types and error handling.`,
          }),
        };
      });

      // Mock file operations for multiple files
      mockFs.readFile.mockImplementation(async (filePath) => {
        const fileName = path.basename(filePath.toString());
        return fileContents[fileName] || fileContents[`src/${fileName}`] || '';
      });

      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        const fileName = path.basename(filePath.toString());
        if (fileName === 'user.ts') {
          fileContents['src/user.ts'] = content as string;
        }
      });

      const tddExecutor = (orchestrator as any).tddExecutor;
      const result: TDDExecutionResult = await tddExecutor.execute('user-service-e2e');

      // Verify successful completion
      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(6);

      // Verify complex implementation progression
      const finalUserService = fileContents['src/user.ts'];
      expect(finalUserService).toContain('export class UserService');
      expect(finalUserService).toContain('async createUser');
      expect(finalUserService).toContain('async findUser');
      expect(finalUserService).toContain('isValidEmail');
      expect(finalUserService).toContain('Invalid email format');

      // Verify each iteration had meaningful changes
      result.iterations.forEach((iteration, index) => {
        if (index < result.iterations.length - 1) {
          expect(iteration.testResult.success).toBe(false);
          expect(iteration.suggestedFix).toBeDefined();
          expect(iteration.fixResult?.success).toBe(true);
        } else {
          expect(iteration.testResult.success).toBe(true);
          expect(iteration.resolved).toBe(true);
        }
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large test suites efficiently', async () => {
      const largeTestOutput = `
FAIL src/large-suite.test.ts
${Array.from({ length: 50 }, (_, i) => `  × test case ${i + 1}\n    Assertion failed for test ${i + 1}`).join('\n')}
      `;

      let executionTimes: number[] = [];

      mockExec.mockImplementation((command, options, callback) => {
        const startTime = Date.now();

        setTimeout(() => {
          executionTimes.push(Date.now() - startTime);

          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = '';
          (error as any).stderr = largeTestOutput;
          if (callback) callback(error);
        }, 10); // Simulate test execution time

        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix multiple test failures',
          file: 'src/large-suite.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.7,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const startTime = Date.now();
      const tddExecutor = (orchestrator as any).tddExecutor;
      const result: TDDExecutionResult = await tddExecutor.execute('large-suite-test');
      const totalTime = Date.now() - startTime;

      // Verify reasonable performance
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.totalDuration).toBeGreaterThan(0);

      // Verify it handled large test output
      expect(result.iterations[0].testResult.failures).toHaveLength(1);
      expect(result.iterations[0].testResult.stderr).toContain('test case 50');
    });

    it('should handle multiple rapid TDD executions', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        setTimeout(() => {
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }, Math.random() * 10);
        return {};
      });

      const startTime = Date.now();
      const results = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const executor = new TDDExecutor(config.tdd as TDDExecutorConfig, agents);
          return await executor.execute(`rapid-test-${i}`);
        })
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.totalIterations).toBe(1);
      });

      // Should handle concurrent executions efficiently
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('Real-world Error Scenarios', () => {
    it('should handle compilation errors in TypeScript projects', async () => {
      const compilationError = `
FAIL src/typed-module.test.ts
  × Test compilation failed
    TS2304: Cannot find name 'UnknownType'
    TS2322: Type 'string' is not assignable to type 'number'
    TS2339: Property 'nonexistentMethod' does not exist on type 'MyClass'
      `;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = '';
        (error as any).stderr = compilationError;
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix TypeScript compilation errors',
          file: 'src/typed-module.ts',
          originalContent: 'interface BadInterface {\n  prop: UnknownType;\n}',
          newContent: 'interface FixedInterface {\n  prop: string;\n}\n\nexport class MyClass {\n  nonexistentMethod() {\n    return "fixed";\n  }\n}',
          confidence: 0.8,
          reasoning: 'Fixed type errors and added missing method',
        }),
      });

      mockFs.readFile.mockResolvedValue('interface BadInterface {\n  prop: UnknownType;\n}');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executeTDD('npm run test:types', 2, agents);

      expect(result.success).toBe(false);
      expect(result.iterations[0].testResult.failures).toHaveLength(1);
      expect(result.iterations[0].testResult.stderr).toContain('TS2304');
      expect(result.iterations[0].suggestedFix?.description).toContain('TypeScript');
    });

    it('should handle network-dependent test failures', async () => {
      const networkError = `
FAIL src/api.test.ts
  × should fetch user data
    FetchError: request to https://api.example.com/users failed, reason: connect ECONNREFUSED 127.0.0.1:443

  × should handle API timeout
    Error: Timeout: API call took longer than 5000ms
      `;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = '';
        (error as any).stderr = networkError;
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Mock network dependencies in tests',
          file: 'src/api.test.ts',
          originalContent: 'const response = await fetch("https://api.example.com/users");',
          newContent: 'const mockResponse = { users: [{ id: 1, name: "Test" }] };\nconst response = Promise.resolve({ json: () => mockResponse });',
          confidence: 0.9,
          reasoning: 'Replaced real network calls with mocked responses for reliable testing',
        }),
      });

      mockFs.readFile.mockResolvedValue('const response = await fetch("https://api.example.com/users");');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executeTDD('npm test', 3, agents);

      expect(result.iterations[0].suggestedFix?.description).toContain('Mock');
      expect(result.iterations[0].suggestedFix?.reasoning).toContain('mocked');
    });

    it('should handle dependency version conflicts', async () => {
      const dependencyError = `
FAIL src/dependency.test.ts
  × Module resolution failed
    Error: Cannot resolve module '@types/node' from 'src/dependency.ts'

  × Version conflict detected
    Error: Package 'react' version 18.0.0 conflicts with '@types/react' version 17.0.0
      `;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = '';
        (error as any).stderr = dependencyError;
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Update imports to avoid dependency conflicts',
          file: 'src/dependency.ts',
          originalContent: 'import { Node } from "@types/node";\nimport { Component } from "react";',
          newContent: 'import type { Node } from "node:fs";\nimport type { FC } from "react";',
          confidence: 0.7,
          reasoning: 'Updated imports to use compatible versions and avoid conflicts',
        }),
      });

      mockFs.readFile.mockResolvedValue('import { Node } from "@types/node";\nimport { Component } from "react";');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executeTDD('npm test', 2, agents);

      expect(result.iterations[0].testResult.failures).toHaveLength(1);
      expect(result.iterations[0].testResult.stderr).toContain('version conflict');
      expect(result.iterations[0].suggestedFix?.description).toContain('dependency');
    });
  });

  describe('Metrics and Reporting', () => {
    it('should provide detailed execution metrics', async () => {
      let callCount = 0;
      const iterationTimes: number[] = [];

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        const delay = callCount === 1 ? 100 : callCount === 2 ? 150 : 50;

        setTimeout(() => {
          if (callCount <= 2) {
            const error = new Error('Tests failed');
            (error as any).code = 1;
            (error as any).stdout = '';
            (error as any).stderr = `FAIL test.js\n × iteration ${callCount}\n Error ${callCount}`;
            if (callback) callback(error);
          } else {
            if (callback) {
              callback(null, { stdout: 'All tests passed', stderr: '' });
            }
          }
        }, delay);

        return {};
      });

      mockQuery.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 75)); // Simulate Claude processing time
        return {
          content: JSON.stringify({
            description: `Fix iteration ${callCount}`,
            file: 'src/app.ts',
            originalContent: 'old',
            newContent: `new ${callCount}`,
            confidence: 0.8,
          }),
        };
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const tddExecutor = (orchestrator as any).tddExecutor;
      const result: TDDExecutionResult = await tddExecutor.execute('metrics-test');

      // Verify detailed metrics
      expect(result.totalDuration).toBeGreaterThan(300); // Should account for all delays
      expect(result.totalIterations).toBe(3);

      // Verify individual iteration metrics
      result.iterations.forEach((iteration, index) => {
        expect(iteration.duration).toBeGreaterThan(0);
        expect(iteration.startTime).toBeInstanceOf(Date);
        expect(iteration.endTime).toBeInstanceOf(Date);
        expect(iteration.endTime.getTime()).toBeGreaterThan(iteration.startTime.getTime());

        if (index < 2) {
          expect(iteration.testResult.duration).toBeGreaterThan(90); // Account for test delay
        }
      });

      // Verify execution timeline makes sense
      for (let i = 1; i < result.iterations.length; i++) {
        expect(result.iterations[i].startTime.getTime()).toBeGreaterThanOrEqual(
          result.iterations[i - 1].endTime.getTime()
        );
      }
    });

    it('should track resource usage and performance', async () => {
      const largeData = 'x'.repeat(100000); // 100KB of data

      mockExec.mockImplementation((command, options, callback) => {
        setTimeout(() => {
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }, 10);
        return {};
      });

      const memoryBefore = process.memoryUsage().heapUsed;

      const results = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => {
          const executor = new TDDExecutor(config.tdd as TDDExecutorConfig, agents);
          return await executor.execute(`perf-test-${i}`);
        })
      );

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      expect(results).toHaveLength(20);

      // Memory increase should be reasonable (less than 50MB for 20 executions)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // All executions should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.totalDuration).toBeGreaterThan(0);
      });
    });
  });
});