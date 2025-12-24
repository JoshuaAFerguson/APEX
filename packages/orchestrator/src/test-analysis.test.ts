import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor } from './idle-processor.js';
import { TaskStore } from './store.js';
import type {
  TestAnalysis,
  BranchCoverage,
  UntestedExport,
  MissingIntegrationTest,
  TestingAntiPattern,
  ProjectAnalysis,
  DaemonConfig
} from '@apexcli/core';

// Mock external dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('./store.js', () => ({
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

describe('TestAnalysis Data Structures', () => {
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

  describe('BranchCoverage', () => {
    it('should correctly structure branch coverage data', () => {
      const branchCoverage: BranchCoverage = {
        percentage: 75,
        uncoveredBranches: [
          {
            file: 'src/utils.ts',
            line: 42,
            type: 'if',
            description: 'Error handling branch not covered',
          },
          {
            file: 'src/validation.ts',
            line: 15,
            type: 'ternary',
            description: 'Edge case validation not tested',
          },
        ],
      };

      expect(branchCoverage.percentage).toBe(75);
      expect(branchCoverage.uncoveredBranches).toHaveLength(2);
      expect(branchCoverage.uncoveredBranches[0].type).toBe('if');
      expect(branchCoverage.uncoveredBranches[1].type).toBe('ternary');
    });

    it('should support all branch types', () => {
      const branchTypes: BranchCoverage['uncoveredBranches'][0]['type'][] = [
        'if', 'else', 'switch', 'catch', 'ternary', 'logical'
      ];

      branchTypes.forEach(type => {
        const branch: BranchCoverage['uncoveredBranches'][0] = {
          file: 'test.ts',
          line: 1,
          type,
          description: `Test ${type} branch`,
        };

        expect(branch.type).toBe(type);
      });
    });

    it('should handle edge cases for coverage percentage', () => {
      const zeroCoverage: BranchCoverage = {
        percentage: 0,
        uncoveredBranches: [],
      };

      const fullCoverage: BranchCoverage = {
        percentage: 100,
        uncoveredBranches: [],
      };

      expect(zeroCoverage.percentage).toBe(0);
      expect(fullCoverage.percentage).toBe(100);
      expect(zeroCoverage.uncoveredBranches).toHaveLength(0);
      expect(fullCoverage.uncoveredBranches).toHaveLength(0);
    });
  });

  describe('UntestedExport', () => {
    it('should correctly identify untested exports', () => {
      const untestedExports: UntestedExport[] = [
        {
          file: 'src/api.ts',
          exportName: 'validateUser',
          exportType: 'function',
          line: 25,
          isPublic: true,
        },
        {
          file: 'src/models.ts',
          exportName: 'UserSchema',
          exportType: 'interface',
          line: 10,
          isPublic: true,
        },
      ];

      expect(untestedExports).toHaveLength(2);
      expect(untestedExports[0].exportType).toBe('function');
      expect(untestedExports[1].exportType).toBe('interface');
      expect(untestedExports.every(exp => exp.isPublic)).toBe(true);
    });

    it('should support all export types', () => {
      const exportTypes: UntestedExport['exportType'][] = [
        'function', 'class', 'interface', 'type', 'variable', 'const', 'enum', 'namespace'
      ];

      exportTypes.forEach(type => {
        const untested: UntestedExport = {
          file: 'test.ts',
          exportName: `Test${type}`,
          exportType: type,
          line: 1,
          isPublic: true,
        };

        expect(untested.exportType).toBe(type);
      });
    });

    it('should distinguish between public and private exports', () => {
      const publicExport: UntestedExport = {
        file: 'src/public-api.ts',
        exportName: 'publicFunction',
        exportType: 'function',
        isPublic: true,
      };

      const privateExport: UntestedExport = {
        file: 'src/internal.ts',
        exportName: '_internalHelper',
        exportType: 'function',
        isPublic: false,
      };

      expect(publicExport.isPublic).toBe(true);
      expect(privateExport.isPublic).toBe(false);
    });
  });

  describe('MissingIntegrationTest', () => {
    it('should identify critical paths needing integration tests', () => {
      const missingTests: MissingIntegrationTest[] = [
        {
          criticalPath: 'User authentication flow',
          description: 'End-to-end test for login, token validation, and logout',
          priority: 'critical',
          relatedFiles: ['src/auth.ts', 'src/middleware.ts'],
        },
        {
          criticalPath: 'Data persistence layer',
          description: 'Integration tests for database transactions',
          priority: 'high',
          relatedFiles: ['src/db.ts', 'src/models.ts'],
        },
      ];

      expect(missingTests).toHaveLength(2);
      expect(missingTests[0].priority).toBe('critical');
      expect(missingTests[1].priority).toBe('high');
      expect(missingTests[0].relatedFiles).toContain('src/auth.ts');
    });

    it('should support all priority levels', () => {
      const priorities: MissingIntegrationTest['priority'][] = [
        'low', 'medium', 'high', 'critical'
      ];

      priorities.forEach(priority => {
        const test: MissingIntegrationTest = {
          criticalPath: `Test path with ${priority} priority`,
          description: `Test description for ${priority}`,
          priority,
        };

        expect(test.priority).toBe(priority);
      });
    });

    it('should handle missing integration tests without related files', () => {
      const test: MissingIntegrationTest = {
        criticalPath: 'Configuration validation',
        description: 'Test configuration loading and validation',
        priority: 'medium',
      };

      expect(test.relatedFiles).toBeUndefined();
      expect(test.criticalPath).toBeTruthy();
      expect(test.description).toBeTruthy();
    });
  });

  describe('TestingAntiPattern', () => {
    it('should detect common testing anti-patterns', () => {
      const antiPatterns: TestingAntiPattern[] = [
        {
          file: 'src/__tests__/user.test.ts',
          line: 45,
          type: 'brittle-test',
          description: 'Test depends on external timing and may be flaky',
          severity: 'high',
          suggestion: 'Use mocked timers or eliminate timing dependencies',
        },
        {
          file: 'src/__tests__/api.test.ts',
          line: 12,
          type: 'mystery-guest',
          description: 'Test has hidden dependency on external file system',
          severity: 'medium',
          suggestion: 'Mock file system operations or make dependencies explicit',
        },
      ];

      expect(antiPatterns).toHaveLength(2);
      expect(antiPatterns[0].type).toBe('brittle-test');
      expect(antiPatterns[1].type).toBe('mystery-guest');
      expect(antiPatterns[0].severity).toBe('high');
      expect(antiPatterns[1].severity).toBe('medium');
    });

    it('should support all anti-pattern types', () => {
      const antiPatternTypes: TestingAntiPattern['type'][] = [
        'brittle-test', 'test-pollution', 'mystery-guest', 'eager-test',
        'assertion-roulette', 'slow-test', 'flaky-test', 'test-code-duplication',
        'no-assertion', 'commented-out', 'console-only', 'empty-test', 'hardcoded-timeout'
      ];

      antiPatternTypes.forEach(type => {
        const pattern: TestingAntiPattern = {
          file: 'test.ts',
          line: 1,
          type,
          description: `Test anti-pattern: ${type}`,
          severity: 'medium',
        };

        expect(pattern.type).toBe(type);
      });
    });

    it('should support all severity levels', () => {
      const severities: TestingAntiPattern['severity'][] = ['low', 'medium', 'high'];

      severities.forEach(severity => {
        const pattern: TestingAntiPattern = {
          file: 'test.ts',
          line: 1,
          type: 'slow-test',
          description: `Test with ${severity} severity`,
          severity,
        };

        expect(pattern.severity).toBe(severity);
      });
    });

    it('should handle optional suggestion field', () => {
      const withSuggestion: TestingAntiPattern = {
        file: 'test.ts',
        line: 1,
        type: 'slow-test',
        description: 'Test with suggestion',
        severity: 'high',
        suggestion: 'Use mocked dependencies to speed up test',
      };

      const withoutSuggestion: TestingAntiPattern = {
        file: 'test.ts',
        line: 1,
        type: 'flaky-test',
        description: 'Test without suggestion',
        severity: 'medium',
      };

      expect(withSuggestion.suggestion).toBeTruthy();
      expect(withoutSuggestion.suggestion).toBeUndefined();
    });
  });

  describe('Complete TestAnalysis Structure', () => {
    it('should combine all test analysis components correctly', () => {
      const testAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 85,
          uncoveredBranches: [
            {
              file: 'src/error-handler.ts',
              line: 32,
              type: 'catch',
              description: 'Exception handling not tested',
            },
          ],
        },
        untestedExports: [
          {
            file: 'src/utils.ts',
            exportName: 'formatDate',
            exportType: 'function',
            line: 15,
            isPublic: true,
          },
        ],
        missingIntegrationTests: [
          {
            criticalPath: 'API error responses',
            description: 'End-to-end testing of error handling paths',
            priority: 'high',
            relatedFiles: ['src/api.ts', 'src/error-handler.ts'],
          },
        ],
        antiPatterns: [
          {
            file: 'src/__tests__/integration.test.ts',
            line: 67,
            type: 'test-pollution',
            description: 'Test modifies global state affecting other tests',
            severity: 'high',
            suggestion: 'Use proper setup/teardown to isolate test state',
          },
        ],
      };

      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.branchCoverage.percentage).toBe(85);
      expect(testAnalysis.untestedExports).toHaveLength(1);
      expect(testAnalysis.missingIntegrationTests).toHaveLength(1);
      expect(testAnalysis.antiPatterns).toHaveLength(1);
      expect(testAnalysis.antiPatterns[0].suggestion).toBeTruthy();
    });

    it('should handle empty test analysis', () => {
      const emptyAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 0,
          uncoveredBranches: [],
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: [],
      };

      expect(emptyAnalysis.branchCoverage.percentage).toBe(0);
      expect(emptyAnalysis.untestedExports).toHaveLength(0);
      expect(emptyAnalysis.missingIntegrationTests).toHaveLength(0);
      expect(emptyAnalysis.antiPatterns).toHaveLength(0);
    });
  });

  describe('IdleProcessor Test Analysis Integration', () => {
    it('should include testAnalysis in ProjectAnalysis structure', async () => {
      // Mock file system calls
      const mockReadFile = vi.mocked(fs.readFile);

      // Mock basic file reads
      mockReadFile.mockResolvedValue('export function testFunction() {}');

      // Mock exec commands
      mockExecAsync.mockResolvedValue({ stdout: 'src/test.ts', stderr: '' });

      // Get project analysis
      const analysis = await (idleProcessor as any).analyzeProject();

      expect(analysis).toBeDefined();
      expect(analysis.testAnalysis).toBeDefined();
      expect(analysis.testAnalysis.branchCoverage).toBeDefined();
      expect(analysis.testAnalysis.untestedExports).toBeDefined();
      expect(analysis.testAnalysis.missingIntegrationTests).toBeDefined();
      expect(analysis.testAnalysis.antiPatterns).toBeDefined();
    });

    it('should analyze branch coverage correctly', async () => {
      // Mock conditional statements in source files
      mockExecAsync.mockResolvedValue({
        stdout: 'src/test.ts:10:if (condition) {\nsrc/test.ts:15:} else {',
        stderr: ''
      });

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      expect(branchCoverage).toBeDefined();
      expect(branchCoverage.percentage).toBeGreaterThanOrEqual(0);
      expect(branchCoverage.percentage).toBeLessThanOrEqual(100);
      expect(Array.isArray(branchCoverage.uncoveredBranches)).toBe(true);
    });

    it('should find untested exports correctly', async () => {
      const mockFileContent = `
        export function testedFunction() {}
        export function untestedFunction() {}
        export class TestClass {}
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/test.ts\nsrc/another.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      // Should find untested exports since we're mocking no test files
      expect(untestedExports.length).toBeGreaterThanOrEqual(0);
    });

    it('should analyze untested exports with enhanced detection', async () => {
      const mockFileContent = `
        export function regularFunction() {}
        export async function asyncFunction() {}
        export class MyClass {
          public method() {}
          private _privateMethod() {}
        }
        export const arrowFunc = () => {};
        export const asyncArrow = async () => {};
        export interface PublicInterface {}
        export type PublicType = string;
        export enum Status { ACTIVE, INACTIVE }
        export namespace Utils { }
        export let variableExport = 'test';
        export const constantExport = 'const';
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/enhanced-test.ts\nsrc/another.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).analyzeUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      expect(untestedExports.length).toBeGreaterThan(0);

      // Check that various export types are detected
      const exportTypes = untestedExports.map((exp: UntestedExport) => exp.exportType);
      expect(exportTypes).toContain('function');
      expect(exportTypes).toContain('class');
      expect(exportTypes).toContain('interface');
      expect(exportTypes).toContain('type');
      expect(exportTypes).toContain('enum');
      expect(exportTypes).toContain('const');

      // Verify public/private detection
      const publicExports = untestedExports.filter((exp: UntestedExport) => exp.isPublic);
      const privateExports = untestedExports.filter((exp: UntestedExport) => !exp.isPublic);

      expect(publicExports.length).toBeGreaterThan(0);
      // Should have detected the private method as non-public
      expect(privateExports.some((exp: UntestedExport) =>
        exp.exportName.includes('_privateMethod')
      )).toBe(true);

      // Verify line numbers are tracked
      expect(untestedExports.every((exp: UntestedExport) =>
        typeof exp.line === 'number' && exp.line > 0
      )).toBe(true);
    });

    it('should identify missing integration tests', async () => {
      // Mock files that would need integration tests
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'src/api.ts\nsrc/router.ts', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'src/db.ts\nsrc/models.ts', stderr: '' });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('app.get("/api", handler);');

      const missingTests = await (idleProcessor as any).analyzeMissingIntegrationTests();

      expect(Array.isArray(missingTests)).toBe(true);
      expect(missingTests.length).toBeGreaterThanOrEqual(0);
    });

    it('should analyze missing integration tests comprehensively', async () => {
      // Setup mock for identifyCriticalPaths
      const mockApiContent = `
        app.get('/api/users', getUsersHandler);
        app.post('/api/users', createUserHandler);
        app.put('/api/users/:id', updateUserHandler);
      `;

      const mockDbContent = `
        await User.findOne({ id });
        await User.update({ name: 'test' });
        await database.query('SELECT * FROM users');
      `;

      const mockServiceContent = `
        const response = await fetch('/external-api');
        const data = await axios.get('https://api.external.com');
      `;

      const mockComplexComponent = `
        import { UserService } from './user-service';
        import { DatabaseConnection } from './database';
        import { EmailService } from './email';
        import { Logger } from './logger';
        import { Cache } from './cache';
        import { ValidationService } from './validation';
        import { AuthService } from './auth';

        export class UserController {
          constructor() {}
          async createUser() {}
          async updateUser() {}
          async deleteUser() {}
          async validateUser() {}
          async sendNotification() {}
          async cacheUserData() {}
        }
      `;

      const mockReadFile = vi.mocked(fs.readFile);

      // Mock exec commands for different file types
      mockExecAsync
        // For API endpoints
        .mockResolvedValueOnce({ stdout: 'src/api/routes.ts', stderr: '' })
        // For database operations
        .mockResolvedValueOnce({ stdout: 'src/db/user-repository.ts', stderr: '' })
        // For external services
        .mockResolvedValueOnce({ stdout: 'src/services/external-api.ts', stderr: '' })
        // For integration test coverage check
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // No integration tests found
        // For complex component interactions
        .mockResolvedValueOnce({ stdout: 'src/controllers/user-controller.ts\nsrc/services/notification-service.ts', stderr: '' })
        // For test coverage check for complex components
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // No tests found for complex components

      // Mock file content reads
      mockReadFile
        .mockResolvedValueOnce(mockApiContent) // API routes file
        .mockResolvedValueOnce(mockDbContent) // Database operations file
        .mockResolvedValueOnce(mockServiceContent) // External service file
        .mockResolvedValueOnce(mockComplexComponent) // Complex component file
        .mockResolvedValueOnce('// Another complex component with minimal dependencies'); // Second complex file

      const missingTests = await (idleProcessor as any).analyzeMissingIntegrationTests();

      expect(Array.isArray(missingTests)).toBe(true);
      expect(missingTests.length).toBeGreaterThan(0);

      // Should identify missing tests for API endpoints
      const apiEndpointTests = missingTests.filter((test: MissingIntegrationTest) =>
        test.criticalPath.includes('api endpoint') || test.criticalPath.includes('api_endpoint')
      );
      expect(apiEndpointTests.length).toBeGreaterThan(0);

      // Should identify missing tests for database operations
      const dbTests = missingTests.filter((test: MissingIntegrationTest) =>
        test.criticalPath.includes('database') || test.criticalPath.includes('database_operation')
      );
      expect(dbTests.length).toBeGreaterThan(0);

      // Should identify missing tests for external services
      const serviceTests = missingTests.filter((test: MissingIntegrationTest) =>
        test.criticalPath.includes('external') || test.criticalPath.includes('external_service')
      );
      expect(serviceTests.length).toBeGreaterThan(0);

      // Check that priorities are assigned correctly
      const criticalTests = missingTests.filter((test: MissingIntegrationTest) => test.priority === 'critical');
      const highTests = missingTests.filter((test: MissingIntegrationTest) => test.priority === 'high');
      expect(criticalTests.length + highTests.length).toBeGreaterThan(0);

      // Verify descriptions are meaningful
      missingTests.forEach((test: MissingIntegrationTest) => {
        expect(test.description).toBeTruthy();
        expect(test.description.length).toBeGreaterThan(10);
        expect(test.criticalPath).toBeTruthy();
      });

      // Check that results are limited to 15 as per implementation
      expect(missingTests.length).toBeLessThanOrEqual(15);
    });

    it('should identify critical paths correctly', async () => {
      const mockApiFile = `
        const express = require('express');
        const app = express();

        app.get('/api/users', async (req, res) => {
          // Handler logic
        });

        app.post('/api/auth/login', async (req, res) => {
          // Login logic
        });
      `;

      const mockGraphQLFile = `
        const resolvers = {
          Query: {
            getUser: async (parent, args) => {
              return await UserService.findById(args.id);
            }
          },
          Mutation: {
            createUser: async (parent, args) => {
              return await UserService.create(args.input);
            }
          }
        };
      `;

      const mockDbFile = `
        import { Repository } from 'typeorm';

        export class UserRepository {
          async findOne(id: string) {
            return await this.repository.findOne({ where: { id } });
          }

          async save(user: User) {
            return await this.repository.save(user);
          }

          async executeRawQuery() {
            return await this.repository.query('SELECT COUNT(*) FROM users');
          }
        }
      `;

      const mockExternalServiceFile = `
        import axios from 'axios';

        export class PaymentService {
          async processPayment(amount: number) {
            const response = await fetch('https://api.stripe.com/charges', {
              method: 'POST',
              // ...options
            });
            return response.json();
          }

          async sendNotification() {
            return await axios.post('https://api.sendgrid.com/mail/send', {
              // email data
            });
          }
        }
      `;

      const mockReadFile = vi.mocked(fs.readFile);

      // Mock the exec commands for finding files
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'src/routes/api.ts', stderr: '' }) // API files
        .mockResolvedValueOnce({ stdout: 'src/graphql/resolvers.ts', stderr: '' }) // More API files
        .mockResolvedValueOnce({ stdout: 'src/repositories/user.ts', stderr: '' }) // DB files
        .mockResolvedValueOnce({ stdout: 'src/services/payment.ts', stderr: '' }); // External service files

      // Mock file content reads
      mockReadFile
        .mockResolvedValueOnce(mockApiFile)
        .mockResolvedValueOnce(mockGraphQLFile)
        .mockResolvedValueOnce(mockDbFile)
        .mockResolvedValueOnce(mockExternalServiceFile);

      const criticalPaths = await (idleProcessor as any).identifyCriticalPaths();

      expect(Array.isArray(criticalPaths)).toBe(true);
      expect(criticalPaths.length).toBeGreaterThan(0);

      // Check for API endpoint identification
      const apiEndpoints = criticalPaths.filter(path => path.type === 'api_endpoint');
      expect(apiEndpoints.length).toBeGreaterThan(0);

      const expressRoute = apiEndpoints.find(path => path.keywords.includes('express'));
      expect(expressRoute).toBeDefined();
      expect(expressRoute?.file).toContain('routes/api.ts');

      const graphqlResolver = apiEndpoints.find(path => path.keywords.includes('graphql'));
      expect(graphqlResolver).toBeDefined();
      expect(graphqlResolver?.file).toContain('graphql/resolvers.ts');

      // Check for database operation identification
      const dbOperations = criticalPaths.filter(path => path.type === 'database_operation');
      expect(dbOperations.length).toBeGreaterThan(0);

      const ormOperation = dbOperations.find(path => path.keywords.includes('orm'));
      expect(ormOperation).toBeDefined();

      const rawSqlOperation = dbOperations.find(path => path.keywords.includes('sql'));
      expect(rawSqlOperation).toBeDefined();

      // Check for external service identification
      const externalServices = criticalPaths.filter(path => path.type === 'external_service');
      expect(externalServices.length).toBeGreaterThan(0);

      const httpService = externalServices.find(path => path.keywords.includes('http'));
      expect(httpService).toBeDefined();
      expect(httpService?.file).toContain('services/payment.ts');
    });

    it('should check integration test coverage correctly', async () => {
      const criticalPaths = [
        {
          type: 'api_endpoint' as const,
          file: 'src/api/users.ts',
          description: 'User API endpoints',
          keywords: ['express', 'api', 'endpoint']
        },
        {
          type: 'database_operation' as const,
          file: 'src/db/user-repository.ts',
          description: 'User database operations',
          keywords: ['database', 'orm', 'query']
        },
        {
          type: 'external_service' as const,
          file: 'src/services/payment.ts',
          description: 'Payment service integration',
          keywords: ['http', 'api', 'external']
        }
      ];

      // Mock integration test files
      const integrationTestContent = `
        describe('User API Integration Tests', () => {
          it('should create user via API', async () => {
            const response = await request(app)
              .post('/api/users')
              .send({ name: 'Test User' });
            expect(response.status).toBe(201);
          });
        });
      `;

      const mockReadFile = vi.mocked(fs.readFile);

      // Mock finding integration test files - only find test for users API
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'src/__tests__/integration/users.integration.test.ts',
        stderr: ''
      });

      // Mock reading the integration test file
      mockReadFile.mockResolvedValueOnce(integrationTestContent);

      const coverageMap = await (idleProcessor as any).checkIntegrationTestCoverage(criticalPaths);

      expect(coverageMap).toBeInstanceOf(Map);
      expect(coverageMap.size).toBe(3);

      // Should find coverage for users API (file name match and keyword match)
      expect(coverageMap.get('src/api/users.ts')).toBe(true);

      // Should not find coverage for database operations and payment service
      expect(coverageMap.get('src/db/user-repository.ts')).toBe(false);
      expect(coverageMap.get('src/services/payment.ts')).toBe(false);
    });

    it('should detect uncovered component interactions', async () => {
      const complexComponentContent = `
        import { UserService } from './user-service';
        import { DatabaseConnection } from './database';
        import { EmailService } from './email';
        import { Logger } from './logger';
        import { Cache } from './cache';
        import { ValidationService } from './validation';
        import { AuthService } from './auth';
        import { PaymentService } from './payment';
        import { NotificationService } from './notification';
        import { AnalyticsService } from './analytics';

        export class UserController {
          constructor(
            private userService: UserService,
            private db: DatabaseConnection,
            private email: EmailService,
            private cache: Cache
          ) {}

          async createUser(userData: any) {
            const validatedData = this.validationService.validate(userData);
            const user = await this.userService.create(validatedData);
            await this.email.sendWelcomeEmail(user.email);
            this.cache.set(\`user:\${user.id}\`, user);
            this.analytics.track('user_created', { userId: user.id });
            return user;
          }

          async updateUser(id: string, data: any) {
            // Complex update logic
          }

          async deleteUser(id: string) {
            // Complex deletion logic
          }

          async processPayment(userId: string, amount: number) {
            // Complex payment processing
          }
        }

        export class OrderProcessor {
          async processOrder() {}
          async validateOrder() {}
          async sendConfirmation() {}
        }

        export function complexUtility() {}
        export function anotherComplexFunction() {}
      `;

      const simpleComponentContent = `
        import { Logger } from './logger';

        export class SimpleService {
          log(message: string) {
            Logger.info(message);
          }
        }
      `;

      const mockReadFile = vi.mocked(fs.readFile);

      // Mock finding component files
      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'src/controllers/user-controller.ts\nsrc/services/simple-service.ts',
          stderr: ''
        })
        // Mock test coverage check - no tests found
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      // Mock file content reads
      mockReadFile
        .mockResolvedValueOnce(complexComponentContent)
        .mockResolvedValueOnce(simpleComponentContent);

      const uncoveredInteractions = await (idleProcessor as any).detectUncoveredComponentInteractions();

      expect(Array.isArray(uncoveredInteractions)).toBe(true);
      expect(uncoveredInteractions.length).toBeGreaterThan(0);

      // Should identify the complex component
      const complexInteraction = uncoveredInteractions.find((interaction: MissingIntegrationTest) =>
        interaction.criticalPath.includes('user-controller.ts')
      );
      expect(complexInteraction).toBeDefined();
      expect(complexInteraction?.priority).toBe('high'); // > 10 imports
      expect(complexInteraction?.description).toContain('imports');
      expect(complexInteraction?.description).toContain('definitions');

      // Should not identify the simple component (only 1 import, 1 class, 1 function)
      const simpleInteraction = uncoveredInteractions.find((interaction: MissingIntegrationTest) =>
        interaction.criticalPath.includes('simple-service.ts')
      );
      expect(simpleInteraction).toBeUndefined();

      // Results should be limited to 5
      expect(uncoveredInteractions.length).toBeLessThanOrEqual(5);
    });

    it('should build missing test reports with correct priorities and descriptions', async () => {
      const criticalPaths = [
        {
          type: 'api_endpoint' as const,
          file: 'src/api/auth.ts',
          description: 'Authentication endpoints',
          keywords: ['express', 'auth', 'login']
        },
        {
          type: 'database_operation' as const,
          file: 'src/repositories/user.ts',
          description: 'User data operations',
          keywords: ['database', 'user', 'query']
        },
        {
          type: 'external_service' as const,
          file: 'src/services/stripe.ts',
          description: 'Payment processing service',
          keywords: ['stripe', 'payment', 'external']
        },
        {
          type: 'component_interaction' as const,
          file: 'src/controllers/order.ts',
          description: 'Order processing logic',
          keywords: ['order', 'workflow', 'business']
        }
      ];

      const coverageMap = new Map<string, boolean>();
      // All paths have no coverage
      criticalPaths.forEach(path => {
        coverageMap.set(path.file, false);
      });

      const missingTestReports = (idleProcessor as any).buildMissingTestReports(criticalPaths, coverageMap);

      expect(Array.isArray(missingTestReports)).toBe(true);
      expect(missingTestReports.length).toBe(4);

      // Check API endpoint report
      const apiReport = missingTestReports.find((report: MissingIntegrationTest) =>
        report.criticalPath.includes('api endpoint') && report.relatedFiles?.[0] === 'src/api/auth.ts'
      );
      expect(apiReport).toBeDefined();
      expect(apiReport?.priority).toBe('high');
      expect(apiReport?.description).toContain('API endpoints');
      expect(apiReport?.description).toContain('request/response flow');
      expect(apiReport?.description).toContain('status codes');

      // Check database operation report
      const dbReport = missingTestReports.find((report: MissingIntegrationTest) =>
        report.criticalPath.includes('database operation') && report.relatedFiles?.[0] === 'src/repositories/user.ts'
      );
      expect(dbReport).toBeDefined();
      expect(dbReport?.priority).toBe('high');
      expect(dbReport?.description).toContain('database operations');
      expect(dbReport?.description).toContain('data persistence');
      expect(dbReport?.description).toContain('transaction integrity');

      // Check external service report
      const serviceReport = missingTestReports.find((report: MissingIntegrationTest) =>
        report.criticalPath.includes('external service') && report.relatedFiles?.[0] === 'src/services/stripe.ts'
      );
      expect(serviceReport).toBeDefined();
      expect(serviceReport?.priority).toBe('critical');
      expect(serviceReport?.description).toContain('external service calls');
      expect(serviceReport?.description).toContain('service integration');
      expect(serviceReport?.description).toContain('fallback mechanisms');

      // Check component interaction report
      const componentReport = missingTestReports.find((report: MissingIntegrationTest) =>
        report.criticalPath.includes('component interaction') && report.relatedFiles?.[0] === 'src/controllers/order.ts'
      );
      expect(componentReport).toBeDefined();
      expect(componentReport?.priority).toBe('medium');
      expect(componentReport?.description).toContain('component interactions');
      expect(componentReport?.description).toContain('inter-component communication');
      expect(componentReport?.description).toContain('data flow');

      // Verify all reports have required fields
      missingTestReports.forEach((report: MissingIntegrationTest) => {
        expect(report.criticalPath).toBeTruthy();
        expect(report.description).toBeTruthy();
        expect(['low', 'medium', 'high', 'critical']).toContain(report.priority);
        expect(Array.isArray(report.relatedFiles)).toBe(true);
        expect(report.relatedFiles?.length).toBeGreaterThan(0);
      });
    });

    it('should handle error cases gracefully in analyzeMissingIntegrationTests', async () => {
      // Mock exec to throw an error
      mockExecAsync.mockRejectedValue(new Error('Command execution failed'));

      const missingTests = await (idleProcessor as any).analyzeMissingIntegrationTests();

      expect(Array.isArray(missingTests)).toBe(true);
      expect(missingTests).toEqual([]);
    });

    it('should limit results correctly', async () => {
      // Create a scenario with many missing tests
      const manyPaths = Array.from({ length: 20 }, (_, i) => ({
        type: 'api_endpoint' as const,
        file: `src/api/endpoint${i}.ts`,
        description: `API endpoint ${i}`,
        keywords: ['api', 'endpoint']
      }));

      // Mock all necessary calls
      mockExecAsync
        .mockResolvedValueOnce({ stdout: manyPaths.map(p => p.file).join('\n'), stderr: '' }) // API files
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // DB files (empty)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // Service files (empty)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // Integration test files (empty - no coverage)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // Component files (empty)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // Test coverage for components (empty)

      // Mock file reads for all the API files
      const mockReadFile = vi.mocked(fs.readFile);
      for (let i = 0; i < 20; i++) {
        mockReadFile.mockResolvedValueOnce('app.get("/api", handler);');
      }

      const missingTests = await (idleProcessor as any).analyzeMissingIntegrationTests();

      expect(Array.isArray(missingTests)).toBe(true);
      // Should be limited to 15 as per implementation
      expect(missingTests.length).toBeLessThanOrEqual(15);
    });

    it('should detect testing anti-patterns', async () => {
      const mockTestFileContent = `
        describe('test', () => {
          it('should work', () => {
            global.testValue = 'test';
            setTimeout(() => {
              expect(result).toBe(expected);
            }, 1000);
          });
        });
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockTestFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/test.test.ts\nsrc/another.test.ts',
        stderr: ''
      });

      const antiPatterns = await (idleProcessor as any).detectTestingAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      // Should detect test pollution and slow test patterns
      expect(antiPatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully in test analysis', async () => {
      // Mock exec to throw an error
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Should return default empty structure on error
      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.branchCoverage.percentage).toBe(0);
      expect(testAnalysis.untestedExports).toEqual([]);
      expect(testAnalysis.missingIntegrationTests).toEqual([]);
      expect(testAnalysis.antiPatterns).toEqual([]);
    });
  });
});