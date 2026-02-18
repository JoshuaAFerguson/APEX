/**
 * Integration Tests for JSDoc Validation System
 *
 * Tests the complete JSDoc validation workflow including TypeScript
 * compilation validation, coverage analysis, and report generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performValidation, type ValidationReport } from '../../scripts/validate-jsdoc-comprehensive';

const execAsync = promisify(exec);

describe('JSDoc Validation System - Integration Tests', () => {
  const testDataDir = path.join(__dirname, 'test-data');
  const tempTsConfig = path.join(__dirname, 'temp-tsconfig.json');

  beforeEach(async () => {
    // Ensure test data directory exists
    await fs.mkdir(testDataDir, { recursive: true });

    // Create temporary TypeScript config for testing
    const tsConfig = {
      compilerOptions: {
        noEmit: true,
        strict: true,
        noImplicitAny: true,
        checkJs: false,
        allowJs: false,
        skipLibCheck: true
      },
      include: [path.join(testDataDir, '**/*.ts')]
    };

    await fs.writeFile(tempTsConfig, JSON.stringify(tsConfig, null, 2));
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      await fs.rm(tempTsConfig, { force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Validation Workflow', () => {
    it('should validate a well-documented codebase', async () => {
      // Create test files with good documentation
      const wellDocumentedFile = `
/**
 * A utility class for handling user authentication and session management.
 * Provides methods for login, logout, and token validation.
 * @example
 * const auth = new AuthManager();
 * const user = await auth.login('user@example.com', 'password');
 */
export class AuthManager {
  /**
   * Authenticates a user with email and password
   * @param {string} email - The user's email address
   * @param {string} password - The user's password
   * @returns {Promise<User>} The authenticated user object
   * @throws {AuthError} When authentication fails
   */
  async login(email: string, password: string): Promise<User> {
    // Implementation here
    return {} as User;
  }

  /**
   * Logs out the current user and invalidates their session
   * @returns {Promise<void>} Resolves when logout is complete
   */
  async logout(): Promise<void> {
    // Implementation here
  }
}

/**
 * Represents a user in the system
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
}

/**
 * Configuration options for API requests
 */
export type ApiConfig = {
  /** Base URL for the API */
  baseUrl: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** API key for authentication */
  apiKey?: string;
};

/**
 * Creates a new API client with the given configuration
 * @param {ApiConfig} config - Configuration options
 * @returns {ApiClient} A configured API client instance
 */
export function createApiClient(config: ApiConfig): ApiClient {
  return {} as ApiClient;
}

/**
 * API client interface
 */
export interface ApiClient {
  /** Make a GET request */
  get(url: string): Promise<any>;
  /** Make a POST request */
  post(url: string, data: any): Promise<any>;
}

/**
 * Default timeout for API requests in milliseconds
 */
export const DEFAULT_TIMEOUT = 5000;

/**
 * Supported authentication methods
 */
export enum AuthMethod {
  /** Basic authentication with username/password */
  BASIC = 'basic',
  /** OAuth 2.0 authentication */
  OAUTH = 'oauth',
  /** API key authentication */
  API_KEY = 'api_key'
}
`;

      await fs.writeFile(
        path.join(testDataDir, 'well-documented.ts'),
        wellDocumentedFile
      );

      // Run validation on the well-documented file
      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));
        const report = await performValidation({
          minCoverageThreshold: 85,
          minDescriptionLength: 15,
          requiredFunctionTags: [],
          requiredClassTags: [],
          validateParamTags: true,
          validateReturnTags: true,
          includeTypeExports: true
        });

        expect(report.passed).toBe(true);
        expect(report.coverageStats.coveragePercentage).toBeGreaterThanOrEqual(85);
        expect(report.typeScriptValidation.success).toBe(true);
        expect(report.formattingIssues.length).toBe(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should identify issues in poorly documented code', async () => {
      // Create test files with poor documentation
      const poorlyDocumentedFile = `
// No JSDoc
export function badFunction(a, b) {
  return a + b;
}

/**
 * Bad
 */
export class BadClass {
  // No documentation
  method() {}
}

// No JSDoc at all
export interface BadInterface {
  prop: string;
}

/**
 * @deprecated
 */
export function poorlyDeprecated() {}

export const UNDOCUMENTED_CONSTANT = 'value';
`;

      await fs.writeFile(
        path.join(testDataDir, 'poorly-documented.ts'),
        poorlyDocumentedFile
      );

      // Run validation on the poorly documented file
      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));
        const report = await performValidation({
          minCoverageThreshold: 85,
          minDescriptionLength: 15,
          requiredFunctionTags: [],
          requiredClassTags: [],
          validateParamTags: true,
          validateReturnTags: true,
          includeTypeExports: true
        });

        expect(report.passed).toBe(false);
        expect(report.coverageStats.coveragePercentage).toBeLessThan(85);
        expect(report.summary.missingDocumentation).toBeGreaterThan(0);
        expect(report.summary.formattingIssues).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('TypeScript Compilation Validation', () => {
    it('should pass TypeScript validation with correct JSDoc types', async () => {
      const validTypeScriptFile = `
/**
 * Adds two numbers together
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum
 */
export function addNumbers(a: number, b: number): number {
  return a + b;
}

/**
 * User profile information
 */
export interface UserProfile {
  /** User's unique identifier */
  id: number;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
}
`;

      await fs.writeFile(
        path.join(testDataDir, 'valid-typescript.ts'),
        validTypeScriptFile
      );

      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
        // If no error is thrown, TypeScript compilation succeeded
        expect(true).toBe(true);
      } catch (error) {
        // If TypeScript compilation fails, test should fail
        throw new Error(`TypeScript compilation failed: ${error}`);
      }
    });

    it('should fail TypeScript validation with type errors', async () => {
      const invalidTypeScriptFile = `
/**
 * Function with type errors
 * @param {string} input - Should be string but used as number
 * @returns {number} Return type mismatch
 */
export function typeErrorFunction(input: string): number {
  // This should cause a TypeScript error
  return input.length + "error"; // Type error: string + string != number
}
`;

      await fs.writeFile(
        path.join(testDataDir, 'invalid-typescript.ts'),
        invalidTypeScriptFile
      );

      let compilationFailed = false;
      try {
        await execAsync(`npx tsc --project ${tempTsConfig} --noEmit`);
      } catch (error) {
        compilationFailed = true;
        expect(error).toBeDefined();
      }

      expect(compilationFailed).toBe(true);
    });
  });

  describe('Coverage Report Generation', () => {
    it('should generate accurate coverage statistics', async () => {
      const mixedDocumentationFile = `
/**
 * Well documented function
 * @param input - The input parameter
 * @returns The processed result
 */
export function documentedFunction(input: string): string {
  return input.toUpperCase();
}

// Not documented
export function undocumentedFunction() {
  return 'hello';
}

/**
 * Partially documented
 */
export function partiallyDocumentedFunction(param: number) {
  return param * 2;
}

export const UNDOCUMENTED_CONST = 'value';

/**
 * Well documented constant
 */
export const DOCUMENTED_CONST = 42;
`;

      await fs.writeFile(
        path.join(testDataDir, 'mixed-documentation.ts'),
        mixedDocumentationFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));
        const report = await performValidation();

        // Should have mixed results
        expect(report.coverageStats.totalExports).toBeGreaterThan(0);
        expect(report.coverageStats.documentedExports).toBeGreaterThan(0);
        expect(report.coverageStats.undocumentedExports).toBeGreaterThan(0);
        expect(report.coverageStats.coveragePercentage).toBeGreaterThan(0);
        expect(report.coverageStats.coveragePercentage).toBeLessThan(100);

        // Should have formatting issues for partially documented functions
        expect(report.formattingIssues.length).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle files with no exports', async () => {
      const noExportsFile = `
// This file has no exports
const localVariable = 'local';

function localFunction() {
  return 'local';
}

interface LocalInterface {
  prop: string;
}
`;

      await fs.writeFile(
        path.join(testDataDir, 'no-exports.ts'),
        noExportsFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));
        const report = await performValidation();

        // Should handle gracefully
        expect(report).toBeDefined();
        expect(report.typeScriptValidation.success).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Formatting Issue Detection', () => {
    it('should detect various formatting issues', async () => {
      const formattingIssuesFile = `
/**
 * Missing period at end
 */
export function missingPeriod() {}

/**
 * Bad description: function
 */
export function genericDescription() {}

/**
 * Good description with proper formatting.
 * @param input - Missing type annotation
 */
export function missingTypeAnnotation(input: string) {}

/**
 * Function with parameters but no @param tags.
 */
export function missingParamTags(a: string, b: number) {}

/**
 * Complex function that should have an example but doesn't have one because it's quite complex and would benefit from showing usage patterns.
 */
export function complexFunctionWithoutExample(config: any, options: any) {
  // Complex implementation here
  return processComplexLogic(config, options);
}

declare function processComplexLogic(config: any, options: any): any;
`;

      await fs.writeFile(
        path.join(testDataDir, 'formatting-issues.ts'),
        formattingIssuesFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));
        const report = await performValidation({
          minCoverageThreshold: 50, // Lower threshold to focus on formatting
          minDescriptionLength: 15,
          requiredFunctionTags: [],
          requiredClassTags: [],
          validateParamTags: true,
          validateReturnTags: true,
          includeTypeExports: true
        });

        expect(report.formattingIssues.length).toBeGreaterThan(0);

        // Check for specific issue types
        const issueTypes = report.formattingIssues.map(issue => issue.type);
        expect(issueTypes).toContain('missing-period');
        expect(issueTypes).toContain('poor-description');
        expect(issueTypes).toContain('malformed-param');
        expect(issueTypes).toContain('missing-example');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Configuration Options', () => {
    it('should respect different coverage thresholds', async () => {
      const testFile = `
/**
 * One documented function.
 */
export function documented() {}

export function undocumented1() {}
export function undocumented2() {}
export function undocumented3() {}
`; // 25% coverage

      await fs.writeFile(
        path.join(testDataDir, 'threshold-test.ts'),
        testFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));

        // Should pass with low threshold
        const lowThresholdReport = await performValidation({
          minCoverageThreshold: 20,
          minDescriptionLength: 10,
          requiredFunctionTags: [],
          requiredClassTags: [],
          validateParamTags: false,
          validateReturnTags: false,
          includeTypeExports: true
        });

        expect(lowThresholdReport.passed).toBe(true);

        // Should fail with high threshold
        const highThresholdReport = await performValidation({
          minCoverageThreshold: 90,
          minDescriptionLength: 10,
          requiredFunctionTags: [],
          requiredClassTags: [],
          validateParamTags: false,
          validateReturnTags: false,
          includeTypeExports: true
        });

        expect(highThresholdReport.passed).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate required tags when configured', async () => {
      const testFile = `
/**
 * Function without required tags.
 */
export function testFunction() {}
`;

      await fs.writeFile(
        path.join(testDataDir, 'required-tags-test.ts'),
        testFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));

        const report = await performValidation({
          minCoverageThreshold: 50,
          minDescriptionLength: 10,
          requiredFunctionTags: ['returns', 'example'],
          requiredClassTags: [],
          validateParamTags: true,
          validateReturnTags: true,
          includeTypeExports: true
        });

        expect(report.passed).toBe(false);
        expect(report.summary.missingDocumentation).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle files with syntax errors gracefully', async () => {
      const syntaxErrorFile = `
export function syntaxError( {
  // Missing closing parenthesis and brace
`;

      await fs.writeFile(
        path.join(testDataDir, 'syntax-error.ts'),
        syntaxErrorFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));

        // Should not crash, should report TypeScript errors
        const report = await performValidation();

        expect(report).toBeDefined();
        expect(report.typeScriptValidation.success).toBe(false);
        expect(report.typeScriptValidation.errors.length).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle empty files', async () => {
      await fs.writeFile(path.join(testDataDir, 'empty.ts'), '');

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));

        const report = await performValidation();

        expect(report).toBeDefined();
        expect(report.typeScriptValidation.success).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Report Structure Validation', () => {
    it('should generate complete and well-structured reports', async () => {
      const testFile = `
/**
 * Test function for report validation.
 * @param input - Test input
 * @returns Test output
 */
export function testFunction(input: string): string {
  return input;
}
`;

      await fs.writeFile(
        path.join(testDataDir, 'report-test.ts'),
        testFile
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(path.dirname(__dirname, '..', '..'));

        const report = await performValidation();

        // Validate report structure
        expect(report).toHaveProperty('coverageStats');
        expect(report).toHaveProperty('typeScriptValidation');
        expect(report).toHaveProperty('fileResults');
        expect(report).toHaveProperty('formattingIssues');
        expect(report).toHaveProperty('passed');
        expect(report).toHaveProperty('summary');

        // Validate coverage stats
        expect(report.coverageStats).toHaveProperty('totalExports');
        expect(report.coverageStats).toHaveProperty('documentedExports');
        expect(report.coverageStats).toHaveProperty('coveragePercentage');

        // Validate TypeScript validation
        expect(report.typeScriptValidation).toHaveProperty('success');
        expect(report.typeScriptValidation).toHaveProperty('errors');

        // Validate summary
        expect(report.summary).toHaveProperty('totalIssues');
        expect(report.summary).toHaveProperty('missingDocumentation');
        expect(report.summary).toHaveProperty('formattingIssues');
        expect(report.summary).toHaveProperty('typeScriptErrors');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});