/**
 * ConventionAnalyzer Comprehensive Integration Tests
 *
 * Complete integration tests that validate the full ConventionAnalysis output
 * structure, covering all fields, edge cases, and real-world scenarios.
 * This test suite ensures schema compliance and comprehensive field validation.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema, type ConventionAnalysis } from '@apexcli/core';

// Get the current file's directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ConventionAnalyzer Comprehensive Integration Tests', () => {
  let analyzer: ConventionAnalyzer;
  let tempTestDir: string;

  beforeAll(() => {
    analyzer = new ConventionAnalyzer();
  });

  beforeEach(async () => {
    // Create unique temporary directory for each test
    tempTestDir = join(tmpdir(), `convention-comprehensive-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempTestDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete ConventionAnalysis Schema Validation', () => {
    it('should validate complete schema with all optional fields populated', async () => {
      // Create a comprehensive test project that will populate all fields
      const srcDir = join(tempTestDir, 'src');
      const testDir = join(tempTestDir, '__tests__');
      const libDir = join(tempTestDir, 'lib');
      const configDir = join(tempTestDir, 'config');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });
      await fs.mkdir(libDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });

      // Create comprehensive source files with all patterns
      const mainServiceFile = `
/**
 * User management service with comprehensive documentation
 *
 * @example
 * \`\`\`typescript
 * const manager = new UserManager();
 * const user = await manager.createUser({ name: 'John Doe', email: 'john@example.com' });
 * \`\`\`
 */
export class UserManager {
  /** Maximum number of users allowed */
  private static readonly MAX_USERS = 10000;

  /** Current user count for performance tracking */
  private userCount: number = 0;

  /** Database connection configuration */
  private readonly dbConfig: DatabaseConfig;

  /**
   * Initialize user manager with database configuration
   * @param config - Database configuration object
   */
  constructor(config: DatabaseConfig) {
    this.dbConfig = config;
  }

  /**
   * Create a new user in the system
   * @param userData - User data for creation
   * @returns Promise that resolves to created user
   * @throws {ValidationError} When user data is invalid
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    const validatedData = await this.validateUserData(userData);
    const userId = this.generateUserId();

    const newUser: User = {
      id: userId,
      name: validatedData.name,
      email: validatedData.email,
      createdAt: new Date(),
      isActive: true,
    };

    await this.saveUserToDatabase(newUser);
    this.userCount++;

    return newUser;
  }

  /**
   * Validate user data before creation
   * @param data - Raw user data to validate
   * @returns Validated user data
   * @private
   */
  private async validateUserData(data: CreateUserRequest): Promise<ValidatedUserData> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('User name is required');
    }

    if (!this.isValidEmail(data.email)) {
      throw new ValidationError('Valid email is required');
    }

    return {
      name: data.name.trim(),
      email: data.email.toLowerCase(),
    };
  }

  /**
   * Check if email format is valid
   * @param email - Email address to validate
   * @returns True if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate unique user ID
   * @returns Unique user identifier
   */
  private generateUserId(): string {
    return \`user_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
  }

  /**
   * Save user to database
   * @param user - User object to save
   * @private
   */
  private async saveUserToDatabase(user: User): Promise<void> {
    // Simulated database save
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * User interface definition
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** Account creation timestamp */
  createdAt: Date;
  /** Whether user account is active */
  isActive: boolean;
}

/**
 * User creation request data
 */
export interface CreateUserRequest {
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
}

/**
 * Validated user data after processing
 */
interface ValidatedUserData {
  name: string;
  email: string;
}

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
`;

      const utilsFile = `
/**
 * String utility functions for data processing
 */

/**
 * Convert string to camelCase format
 * @param input - String to convert
 * @returns Converted camelCase string
 */
export function toCamelCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

/**
 * Convert string to kebab-case format
 * @param input - String to convert
 * @returns Converted kebab-case string
 */
export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert string to snake_case format
 * @param input - String to convert
 * @returns Converted snake_case string
 */
export function toSnakeCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Maximum string length for processing */
export const MAX_STRING_LENGTH = 1000;

/** Default string encoding format */
export const DEFAULT_ENCODING = 'utf-8';

/** String processing configuration */
export const STRING_CONFIG = {
  trimWhitespace: true,
  preserveCase: false,
  maxLength: MAX_STRING_LENGTH,
} as const;
`;

      const dataProcessorFile = `
import { UserManager, type User } from './userManager.js';
import { toCamelCase, toKebabCase, MAX_STRING_LENGTH } from './stringUtils.js';

/**
 * Data processing service for user operations
 * Handles batch processing and data transformations
 */
export class DataProcessor {
  /** Batch size for processing operations */
  private static readonly BATCH_SIZE = 100;

  /** Processing timeout in milliseconds */
  private readonly PROCESSING_TIMEOUT = 30000;

  /** User manager instance */
  private userManager: UserManager;

  /** Current processing state */
  private isProcessing: boolean = false;

  /**
   * Initialize data processor
   * @param userManager - User manager instance
   */
  constructor(userManager: UserManager) {
    this.userManager = userManager;
  }

  /**
   * Process batch of user data
   * @param userData - Array of user data to process
   * @returns Processing results
   */
  async processBatch(userData: Array<{ name: string; email: string }>): Promise<ProcessingResult> {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    this.isProcessing = true;

    try {
      const processedUsers: User[] = [];
      const errors: ProcessingError[] = [];

      for (const data of userData) {
        try {
          const processedName = this.processName(data.name);
          const processedEmail = this.processEmail(data.email);

          const user = await this.userManager.createUser({
            name: processedName,
            email: processedEmail,
          });

          processedUsers.push(user);
        } catch (error) {
          errors.push({
            data,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        successCount: processedUsers.length,
        errorCount: errors.length,
        users: processedUsers,
        errors,
        processedAt: new Date(),
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process and validate name data
   * @param name - Raw name string
   * @returns Processed name
   */
  private processName(name: string): string {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      throw new Error('Name cannot be empty');
    }

    if (trimmedName.length > MAX_STRING_LENGTH) {
      throw new Error('Name too long');
    }

    // Convert to proper case
    return trimmedName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Process and validate email data
   * @param email - Raw email string
   * @returns Processed email
   */
  private processEmail(email: string): string {
    const trimmedEmail = email.trim().toLowerCase();

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    return trimmedEmail;
  }
}

/**
 * Processing result interface
 */
export interface ProcessingResult {
  /** Number of successfully processed items */
  successCount: number;
  /** Number of failed items */
  errorCount: number;
  /** Successfully processed users */
  users: User[];
  /** Processing errors */
  errors: ProcessingError[];
  /** Processing completion timestamp */
  processedAt: Date;
}

/**
 * Processing error details
 */
interface ProcessingError {
  /** Original data that failed processing */
  data: { name: string; email: string };
  /** Error message */
  error: string;
}
`;

      // Create test files
      const testFile1 = `
import { describe, it, expect, beforeEach } from 'vitest';
import { UserManager, ValidationError } from '../src/userManager.js';

describe('UserManager', () => {
  let userManager: UserManager;

  beforeEach(() => {
    const config = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
    };
    userManager = new UserManager(config);
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
      };

      const result = await userManager.createUser(userData);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john.doe@example.com');
      expect(result.id).toMatch(/^user_\\d+_[a-z0-9]+$/);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw ValidationError for invalid name', async () => {
      const userData = {
        name: '',
        email: 'john.doe@example.com',
      };

      await expect(userManager.createUser(userData)).rejects.toThrow(ValidationError);
      await expect(userManager.createUser(userData)).rejects.toThrow('User name is required');
    });

    it('should throw ValidationError for invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      await expect(userManager.createUser(userData)).rejects.toThrow(ValidationError);
      await expect(userManager.createUser(userData)).rejects.toThrow('Valid email is required');
    });

    it('should normalize email to lowercase', async () => {
      const userData = {
        name: 'John Doe',
        email: 'John.Doe@EXAMPLE.COM',
      };

      const result = await userManager.createUser(userData);

      expect(result.email).toBe('john.doe@example.com');
    });

    it('should trim whitespace from name', async () => {
      const userData = {
        name: '  John Doe  ',
        email: 'john.doe@example.com',
      };

      const result = await userManager.createUser(userData);

      expect(result.name).toBe('John Doe');
    });
  });
});
`;

      const testFile2 = `
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataProcessor } from '../src/dataProcessor.js';
import { UserManager } from '../src/userManager.js';

// Mock UserManager
vi.mock('../src/userManager.js');

describe('DataProcessor', () => {
  let dataProcessor: DataProcessor;
  let mockUserManager: UserManager;

  beforeEach(() => {
    mockUserManager = vi.mocked(new UserManager({} as any));
    dataProcessor = new DataProcessor(mockUserManager);
  });

  describe('processBatch', () => {
    it('should process batch successfully', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
        isActive: true,
      };

      mockUserManager.createUser = vi.fn().mockResolvedValue(mockUser);

      const userData = [
        { name: 'john doe', email: 'JOHN@EXAMPLE.COM' },
        { name: 'jane smith', email: 'jane@example.com' },
      ];

      const result = await dataProcessor.processBatch(userData);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.users).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it('should handle processing errors gracefully', async () => {
      mockUserManager.createUser = vi.fn()
        .mockResolvedValueOnce({
          id: 'user_123',
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: new Date(),
          isActive: true,
        })
        .mockRejectedValueOnce(new Error('Duplicate email'));

      const userData = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'duplicate@example.com' },
      ];

      const result = await dataProcessor.processBatch(userData);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.users).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Duplicate email');
    });

    it('should reject empty names', async () => {
      const userData = [
        { name: '', email: 'test@example.com' },
      ];

      const result = await dataProcessor.processBatch(userData);

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toBe('Name cannot be empty');
    });

    it('should reject invalid email formats', async () => {
      const userData = [
        { name: 'John Doe', email: 'invalid-email' },
      ];

      const result = await dataProcessor.processBatch(userData);

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toBe('Invalid email format');
    });
  });
});
`;

      // Create config files
      const packageJsonFile = `{
  "name": "comprehensive-test-project",
  "version": "1.0.0",
  "description": "Comprehensive test project for convention analysis",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src",
    "format": "prettier --write src"
  },
  "dependencies": {
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  }
}`;

      const tsconfigFile = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}`;

      const eslintConfigFile = `module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true
  },
  rules: {
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'comma-dangle': ['error', 'always-multiline'],
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn'
  }
};`;

      // Write all files
      await fs.writeFile(join(srcDir, 'userManager.ts'), mainServiceFile);
      await fs.writeFile(join(srcDir, 'stringUtils.ts'), utilsFile);
      await fs.writeFile(join(srcDir, 'dataProcessor.ts'), dataProcessorFile);
      await fs.writeFile(join(testDir, 'userManager.test.ts'), testFile1);
      await fs.writeFile(join(testDir, 'dataProcessor.test.ts'), testFile2);
      await fs.writeFile(join(tempTestDir, 'package.json'), packageJsonFile);
      await fs.writeFile(join(tempTestDir, 'tsconfig.json'), tsconfigFile);
      await fs.writeFile(join(configDir, 'eslint.config.js'), eslintConfigFile);

      // Analyze the project
      const result = await analyzer.analyze(tempTestDir);

      // Validate complete schema compliance
      const parsed = ConventionAnalysisSchema.parse(result);

      // Validate all top-level required fields exist with correct types
      expect(parsed.fileNaming).toMatch(/^(camelCase|PascalCase|kebab-case|snake_case|mixed|inconsistent)$/);
      expect(parsed.functionNaming).toMatch(/^(camelCase|PascalCase|snake_case|mixed|inconsistent)$/);
      expect(parsed.variableNaming).toMatch(/^(camelCase|PascalCase|snake_case|SCREAMING_SNAKE_CASE|mixed|inconsistent)$/);

      // Validate indentation structure
      expect(parsed.indentation).toBeDefined();
      expect(parsed.indentation.type).toMatch(/^(spaces|tabs|mixed)$/);
      if (parsed.indentation.size !== undefined) {
        expect(parsed.indentation.size).toBeGreaterThanOrEqual(1);
        expect(parsed.indentation.size).toBeLessThanOrEqual(8);
        expect(Number.isInteger(parsed.indentation.size)).toBe(true);
      }

      // Validate imports structure
      expect(parsed.imports).toBeDefined();
      expect(parsed.imports.style).toMatch(/^(es6|commonjs|amd|umd|mixed)$/);
      if (parsed.imports.grouping !== undefined) {
        expect(parsed.imports.grouping).toMatch(/^(none|type-separate|source-separate|alphabetical|custom)$/);
      }
      if (parsed.imports.quotes !== undefined) {
        expect(parsed.imports.quotes).toMatch(/^(single|double|mixed)$/);
      }

      // Validate documentation structure
      expect(parsed.documentation).toBeDefined();
      expect(parsed.documentation.style).toMatch(/^(jsdoc|tsdoc|inline|markdown|none|mixed)$/);
      expect(parsed.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(parsed.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(parsed.documentation.coverage)).toBe(true);

      // Validate optional class and constant naming
      if (parsed.classNaming !== undefined) {
        expect(parsed.classNaming).toMatch(/^(PascalCase|camelCase|snake_case|mixed|inconsistent)$/);
      }
      if (parsed.constantNaming !== undefined) {
        expect(parsed.constantNaming).toMatch(/^(SCREAMING_SNAKE_CASE|camelCase|PascalCase|mixed|inconsistent)$/);
      }

      // Validate optional formatting structure
      if (parsed.formatting !== undefined) {
        if (parsed.formatting.lineLength !== undefined) {
          expect(parsed.formatting.lineLength).toBeGreaterThanOrEqual(40);
          expect(parsed.formatting.lineLength).toBeLessThanOrEqual(200);
          expect(Number.isInteger(parsed.formatting.lineLength)).toBe(true);
        }
        if (parsed.formatting.semicolons !== undefined) {
          expect(parsed.formatting.semicolons).toMatch(/^(required|optional|mixed)$/);
        }
        if (parsed.formatting.quotes !== undefined) {
          expect(parsed.formatting.quotes).toMatch(/^(single|double|backtick|mixed)$/);
        }
        if (parsed.formatting.trailingCommas !== undefined) {
          expect(parsed.formatting.trailingCommas).toMatch(/^(always|never|es5|mixed)$/);
        }
      }

      // Validate optional organization structure
      if (parsed.organization !== undefined) {
        expect(parsed.organization.testLocation).toMatch(/^(colocated|separate-tests|separate-__tests__|mixed)$/);
        expect(parsed.organization.testNaming).toMatch(/^(suffix-\.test|suffix-\.spec|suffix-Test|prefix-test-|mixed)$/);
        expect(parsed.organization.sourceStructure).toMatch(/^(src|lib|app|source|root-level|mixed)$/);
        if (parsed.organization.configLocation !== undefined) {
          expect(parsed.organization.configLocation).toMatch(/^(root|config-dir|mixed)$/);
        }
      }

      // Additional specific validations for this comprehensive test
      expect(parsed.fileNaming).toBe('camelCase');
      expect(parsed.classNaming).toBe('PascalCase');
      expect(parsed.constantNaming).toBe('SCREAMING_SNAKE_CASE');
      expect(parsed.imports.style).toBe('es6');
      expect(['jsdoc', 'tsdoc']).toContain(parsed.documentation.style);
      expect(parsed.documentation.coverage).toBeGreaterThan(80); // High documentation coverage
      expect(parsed.organization?.testLocation).toBe('separate-__tests__');
      expect(parsed.organization?.testNaming).toBe('suffix-.test');
      expect(parsed.organization?.sourceStructure).toBe('src');
      expect(parsed.organization?.configLocation).toBe('config-dir');
    });

    it('should validate schema with minimal optional fields', async () => {
      // Create minimal project with only required patterns
      const minimalFile = `
function simpleFunction() {
  const message = 'hello world';
  return message;
}

export { simpleFunction };
`;

      await fs.writeFile(join(tempTestDir, 'simple.js'), minimalFile);

      const result = await analyzer.analyze(tempTestDir);

      // Should pass schema validation even with minimal content
      const parsed = ConventionAnalysisSchema.parse(result);

      // All required fields should be present
      expect(parsed.fileNaming).toBeDefined();
      expect(parsed.functionNaming).toBeDefined();
      expect(parsed.variableNaming).toBeDefined();
      expect(parsed.indentation).toBeDefined();
      expect(parsed.imports).toBeDefined();
      expect(parsed.documentation).toBeDefined();

      // Optional fields may be undefined
      expect(parsed.classNaming).toBeUndefined();
      expect(parsed.constantNaming).toBeUndefined();
    });
  });

  describe('Edge Case Validation - Schema Compliance', () => {
    it('should handle project with all edge case patterns', async () => {
      const srcDir = join(tempTestDir, 'src');
      const testsDir = join(tempTestDir, 'tests');
      const libDir = join(tempTestDir, 'lib');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(libDir, { recursive: true });

      // File with tabs and mixed indentation
      const tabFile = `
class TabIndentedClass {
\tconstructor() {
\t\tthis.mixed_variable = 'tabs';
  \t  this.confusing_indent = 'mixed';
\t}

\tget_mixed_method() {
\t\treturn this.mixed_variable;
\t}
}
`;

      // File with spaces and different conventions
      const spaceFile = `
export class SpaceIndentedClass {
  constructor() {
    this.camelCaseVar = 'spaces';
    this.snake_case_var = 'mixed_naming';
  }

  async camelCaseMethod() {
    return this.camelCaseVar;
  }

  snake_case_method() {
    return this.snake_case_var;
  }
}
`;

      // Old style CommonJS file
      const commonjsFile = `
const path = require("path");
const fs = require('fs');

// Mixed quote styles
function process_data(input_data) {
  const CONSTANT_VALUE = "mixed constants";
  const another_constant = 'another style';

  return {
    "result": input_data,
    'status': 'success'
  };
}

module.exports = { process_data };
`;

      // Modern ES6 file with different patterns
      const es6File = `
import { readFile } from 'fs/promises';
import type { User } from './types.js';

/**
 * Process user data
 */
export async function processUserData(userData: User[]): Promise<ProcessResult[]> {
  const BATCH_SIZE = 100;
  const results: ProcessResult[] = [];

  for (const user of userData) {
    const processedUser = await processIndividualUser(user);
    results.push(processedUser);
  }

  return results;
}

// Inline comment style
const helper = (data: string) => data.trim();
`;

      // Test file with different naming
      const testFile = `
import { describe, test, expect } from 'vitest';

describe('mixed naming tests', () => {
  test('should handle snake_case test names', () => {
    const test_data = { value: 'test' };
    expect(test_data.value).toBe('test');
  });

  test('shouldHandleCamelCaseTestNames', () => {
    const testData = { value: 'camelCase' };
    expect(testData.value).toBe('camelCase');
  });
});
`;

      await fs.writeFile(join(srcDir, 'tabIndented.ts'), tabFile);
      await fs.writeFile(join(srcDir, 'spaceIndented.ts'), spaceFile);
      await fs.writeFile(join(libDir, 'legacy_utils.js'), commonjsFile);
      await fs.writeFile(join(srcDir, 'modernProcessor.ts'), es6File);
      await fs.writeFile(join(testsDir, 'mixed.test.ts'), testFile);

      const result = await analyzer.analyze(tempTestDir);

      // Must pass schema validation despite edge cases
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed patterns appropriately
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(result.variableNaming);
      expect(result.indentation.type).toBe('mixed');
      expect(['mixed', 'es6']).toContain(result.imports.style);
      expect(['mixed', 'single', 'double']).toContain(result.imports.quotes);

      // Organization should detect test location
      expect(result.organization?.testLocation).toBe('separate-tests');
      expect(result.organization?.testNaming).toBe('suffix-.test');

      // All schema constraints should be satisfied
      if (result.documentation.coverage !== undefined) {
        expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
        expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      }
    });

    it('should handle extreme mixed patterns while maintaining schema validity', async () => {
      // Create extremely mixed project to test edge cases
      const files = [
        {
          name: 'PascalCaseFile.ts',
          content: 'export class PascalCaseClass { private camelCaseVar = 1; }'
        },
        {
          name: 'kebab-case-file.js',
          content: 'function snake_case_func() { const SCREAMING_CONST = 42; }'
        },
        {
          name: 'snake_case_file.py',
          content: 'def python_function():\\n    mixed_variable = "value"\\n    return mixed_variable'
        },
        {
          name: 'weird.NamingFile.tsx',
          content: 'const WeirdComponent = () => <div>Mixed</div>;'
        }
      ];

      for (const file of files) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      // Schema validation must pass
      const parsed = ConventionAnalysisSchema.parse(result);

      // Should handle extreme mixing gracefully
      expect(['mixed', 'inconsistent']).toContain(parsed.fileNaming);
      expect(['mixed', 'inconsistent', 'camelCase']).toContain(parsed.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(parsed.variableNaming);

      // All enum values should be valid
      expect(['spaces', 'tabs', 'mixed']).toContain(parsed.indentation.type);
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(parsed.imports.style);
      expect(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']).toContain(parsed.documentation.style);
    });

    it('should maintain consistent schema output across multiple runs', async () => {
      // Create consistent test project
      const consistentFile = `
/**
 * Consistent service class
 */
export class ConsistentService {
  private readonly CONFIG_VALUE = 'constant';

  constructor() {
    // Constructor implementation
  }

  /**
   * Process data consistently
   */
  processData(inputData: string): string {
    const processedData = inputData.trim();
    return processedData;
  }
}
`;

      await fs.writeFile(join(tempTestDir, 'consistentService.ts'), consistentFile);

      // Run analysis multiple times
      const results = await Promise.all([
        analyzer.analyze(tempTestDir),
        analyzer.analyze(tempTestDir),
        analyzer.analyze(tempTestDir)
      ]);

      // All results should be identical and valid
      for (const result of results) {
        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      }

      // Results should be consistent
      const [first, second, third] = results;
      expect(first).toEqual(second);
      expect(second).toEqual(third);

      // Specific consistency checks
      expect(first.fileNaming).toBe(second.fileNaming);
      expect(first.functionNaming).toBe(second.functionNaming);
      expect(first.indentation.type).toBe(second.indentation.type);
      expect(first.documentation.coverage).toBe(second.documentation.coverage);
    });
  });

  describe('Performance and Reliability - Schema Validation', () => {
    it('should maintain schema validity under performance stress', async () => {
      // Generate large number of files with various patterns
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const fileCount = 100;
      const filePromises = [];

      for (let i = 0; i < fileCount; i++) {
        const content = `
/**
 * Generated class ${i}
 * @param value - Input value for processing
 */
export class GeneratedClass${i} {
  private readonly GENERATED_CONSTANT_${i} = ${i};
  private generatedValue${i}: string = 'value${i}';

  /**
   * Get generated value
   * @returns Current value
   */
  getGeneratedValue${i}(): string {
    const transformedValue = this.generatedValue${i}.toUpperCase();
    const finalValue = transformedValue + this.GENERATED_CONSTANT_${i};
    return finalValue;
  }

  /**
   * Set generated value
   * @param newValue - New value to set
   */
  setGeneratedValue${i}(newValue: string): void {
    if (newValue && newValue.length > 0) {
      this.generatedValue${i} = newValue;
    }
  }
}
`;
        filePromises.push(
          fs.writeFile(join(srcDir, `generated${i}.ts`), content)
        );
      }

      await Promise.all(filePromises);

      const startTime = Date.now();
      const result = await analyzer.analyze(tempTestDir);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds max

      // Schema validation should pass
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect consistent patterns despite large size
      expect(result.fileNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(80);
    });

    it('should gracefully handle corrupted data while maintaining schema', async () => {
      // Create files with unusual but not invalid content
      const files = [
        {
          name: 'valid.ts',
          content: 'export class ValidClass { getValue(): string { return "valid"; } }'
        },
        {
          name: 'unusual.ts',
          content: 'const weird = "string with \\x00 null char"; export { weird };'
        },
        {
          name: 'empty.ts',
          content: ''
        },
        {
          name: 'oneliner.ts',
          content: 'export const x=1,y=2,z=3;function f(){return x+y+z;}export{f};'
        }
      ];

      for (const file of files) {
        await fs.writeFile(join(tempTestDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      // Should handle unusual content gracefully
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should analyze valid parts and ignore problematic parts
      expect(result.fileNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(['camelCase', 'mixed']).toContain(result.functionNaming);
    });
  });
});