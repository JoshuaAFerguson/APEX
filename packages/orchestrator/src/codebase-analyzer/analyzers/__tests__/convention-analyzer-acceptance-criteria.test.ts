/**
 * ConventionAnalyzer Acceptance Criteria Tests
 *
 * These tests specifically validate the acceptance criteria for the naming convention detection feature:
 * - ConventionAnalyzer can detect camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE naming patterns
 * - Returns accurate fileNaming, functionNaming, variableNaming, classNaming, constantNaming values
 * - Matches ConventionAnalysis schema requirements
 * - Tests validate detection of each naming style
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Acceptance Criteria Validation', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-acceptance-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Acceptance Criteria: Detect all four primary naming patterns', () => {
    it('should detect camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE in comprehensive test', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const comprehensiveCode = `
// camelCase functions
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return true; }
const createUser = () => {};
const updateProfile = () => {};

// camelCase variables
const userName = 'john';
const orderTotal = 100.50;
const isActive = true;
let currentUser = null;

// PascalCase classes
export class UserService {
  constructor() {}
  getUserById() { return {}; }
}

export class OrderProcessor {
  processOrder() { return {}; }
}

// SCREAMING_SNAKE_CASE constants
const MAX_USERS = 1000;
const API_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 3;
const CACHE_EXPIRY = 3600;

interface UserData {
  id: string;
  name: string;
}

export const CONFIG_VALUES = {
  HOST: 'localhost',
  PORT: 8080
};
      `;

      // Create camelCase file names
      await fs.writeFile(join(srcDir, 'userService.ts'), comprehensiveCode);
      await fs.writeFile(join(srcDir, 'orderProcessor.ts'), comprehensiveCode);
      await fs.writeFile(join(srcDir, 'dataValidator.ts'), comprehensiveCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should detect pure snake_case patterns correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const snakeCaseCode = `
def get_user_data():
    user_name = 'john'
    user_age = 25
    is_active = True
    return {'name': user_name, 'age': user_age}

def process_order_items():
    item_count = 5
    total_price = 100.50
    order_status = 'pending'
    return {'count': item_count, 'price': total_price}

class user_service:
    def __init__(self):
        self.base_url = 'http://example.com'
        self.timeout = 30

    def create_user(self, user_data):
        request_id = generate_id()
        return self.make_request(request_id, user_data)

class order_processor:
    def process_order(self):
        pass

MAX_USERS = 1000
API_TIMEOUT = 30000
DEFAULT_CACHE_SIZE = 100
      `;

      await fs.writeFile(join(srcDir, 'user_service.py'), snakeCaseCode);
      await fs.writeFile(join(srcDir, 'order_processor.py'), snakeCaseCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('snake_case');
      expect(result.functionNaming).toBe('snake_case');
      expect(result.variableNaming).toBe('snake_case');
      expect(result.classNaming).toBe('snake_case');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });
  });

  describe('Acceptance Criteria: Returns accurate naming values', () => {
    it('should return precise values matching actual code patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const preciseCode = `
// Exactly 5 camelCase functions
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return {}; }
export function calculateTotal() { return {}; }
export function formatResponse() { return {}; }

// Exactly 5 camelCase variables
const userName = 'john';
const orderTotal = 100;
const isActive = true;
const itemCount = 5;
const lastModified = Date.now();

// Exactly 3 PascalCase classes
export class UserService {}
export class OrderProcessor {}
export class DataValidator {}

// Exactly 4 SCREAMING_SNAKE_CASE constants
const MAX_USERS = 1000;
const API_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 3;
const CACHE_EXPIRY_TIME = 3600;
      `;

      await fs.writeFile(join(srcDir, 'userService.ts'), preciseCode);
      await fs.writeFile(join(srcDir, 'orderProcessor.ts'), preciseCode);

      const result = await analyzer.analyze(testDir);

      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
      expect(result.classNaming).toBeDefined();
      expect(result.constantNaming).toBeDefined();
    });

    it('should handle optional values when no classes or constants exist', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const functionsOnlyCode = `
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return {}; }

const userName = 'john';
const orderTotal = 100;
const isActive = true;
      `;

      await fs.writeFile(join(srcDir, 'functionsOnly.ts'), functionsOnlyCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBeUndefined();
      expect(result.constantNaming).toBeUndefined();
    });
  });

  describe('Acceptance Criteria: Schema compliance', () => {
    it('should always pass ConventionAnalysisSchema validation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const edgeCaseCode = `
// Functions with numbers, special cases
export function func123() { return 2; }
export function veryLongFunctionNameWithManyWords() { return 3; }
export function a() { return 4; }

// Variables with edge cases
const abc123 = 2;
const veryLongVariableName = 3;

// Classes with edge cases
export class A {}
export class VeryLongClassName {}

// Constants
const A = 1;
const VERY_LONG_CONSTANT_NAME = 2;
      `;

      await fs.writeFile(join(srcDir, 'edgeCases.ts'), edgeCaseCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify all required fields exist
      expect(result).toHaveProperty('fileNaming');
      expect(result).toHaveProperty('functionNaming');
      expect(result).toHaveProperty('variableNaming');
      expect(result).toHaveProperty('indentation');
      expect(result).toHaveProperty('imports');
      expect(result).toHaveProperty('documentation');

      // Verify enum values are valid
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']).toContain(result.variableNaming);

      if (result.classNaming !== undefined) {
        expect(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).toContain(result.classNaming);
      }

      if (result.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(result.constantNaming);
      }
    });

    it('should handle empty projects gracefully', async () => {
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('mixed');
      expect(result.functionNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
      expect(result.classNaming).toBeUndefined();
      expect(result.constantNaming).toBeUndefined();
    });
  });

  describe('Acceptance Criteria: Validates detection of each naming style', () => {
    it('should comprehensively validate camelCase detection', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const camelCaseValidation = `
// Functions - all camelCase
export function getUserById() { return {}; }
export function createNewUser() { return {}; }
export function updateUserProfile() { return {}; }
export function deleteUserAccount() { return {}; }
const authenticateUser = () => {};

// Variables - all camelCase
const userServiceUrl = 'http://localhost';
const maxRetryAttempts = 3;
const isUserActive = true;
const userAccountBalance = 1000.50;
let currentActiveUser = null;

// Classes should be PascalCase
export class UserService {}
export class AccountManager {}

// Constants should be SCREAMING_SNAKE_CASE
const MAX_USERS = 1000;
const API_TIMEOUT = 30000;
      `;

      await fs.writeFile(join(srcDir, 'userManager.ts'), camelCaseValidation);
      await fs.writeFile(join(srcDir, 'dataProcessor.ts'), camelCaseValidation);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should comprehensively validate SCREAMING_SNAKE_CASE detection', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const screamingSnakeValidation = `
// Constants - all SCREAMING_SNAKE_CASE
const MAX_USERS = 1000;
const MIN_USERS = 1;
const API_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 3;
const DATABASE_CONNECTION = 'localhost';
const CACHE_EXPIRY_TIME = 3600;
const MAX_FILE_SIZE = 1024;
const ERROR_MESSAGE_TEMPLATE = 'Error occurred';
const SUCCESS_STATUS_CODE = 200;

// Regular camelCase functions for contrast
export function getUserData() { return {}; }
export function processOrder() { return {}; }

// PascalCase classes for contrast
export class UserService {}
export class OrderProcessor {}
      `;

      await fs.writeFile(join(srcDir, 'constants.ts'), screamingSnakeValidation);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
    });
  });

  describe('Statistical accuracy and threshold testing', () => {
    it('should correctly identify dominant patterns with 60%+ threshold', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // 70% camelCase, 30% snake_case - should detect camelCase
      const dominantCamelCase = `
// camelCase functions (7 total = 70%)
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return true; }
export function calculateTotal() { return 0; }
export function formatResponse() { return ''; }
export function createSession() { return null; }
export function updateProfile() { return {}; }

// snake_case functions (3 total = 30%)
export function get_user_profile() { return {}; }
export function delete_account() { return {}; }
export function send_notification() { return {}; }
      `;

      await fs.writeFile(join(srcDir, 'dominant.ts'), dominantCamelCase);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
    });

    it('should detect mixed patterns when no single pattern dominates', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // 50% camelCase, 50% snake_case - should detect mixed
      const evenSplit = `
// camelCase functions (5 total = 50%)
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return true; }
export function calculateTotal() { return 0; }
export function formatResponse() { return ''; }

// snake_case functions (5 total = 50%)
export function get_user_profile() { return {}; }
export function delete_account() { return {}; }
export function update_password() { return {}; }
export function send_notification() { return {}; }
export function process_data() { return {}; }
      `;

      await fs.writeFile(join(srcDir, 'even-split.ts'), evenSplit);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
    });
  });

  describe('Error handling and robustness', () => {
    it('should handle syntax errors gracefully', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // File with syntax issues
      const syntaxErrorCode = `
export function badSyntax( {
  return "broken";

const missingAssignment;

export class BadClass {
  someMethod()
}
      `;

      await fs.writeFile(join(srcDir, 'badSyntax.ts'), syntaxErrorCode);

      const result = await analyzer.analyze(testDir);
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
    });

    it('should handle large files efficiently', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Generate file with many functions
      let largeFileContent = '';
      for (let i = 0; i < 100; i++) {
        largeFileContent += `
export function generatedFunction${i}() {
  const localVar${i} = ${i};
  return localVar${i} * 2;
}

export class GeneratedClass${i} {
  process() { return ${i}; }
}

const GENERATED_CONSTANT_${i} = ${i * 100};
        `;
      }

      await fs.writeFile(join(srcDir, 'largefile.ts'), largeFileContent);

      const startTime = Date.now();
      const result = await analyzer.analyze(testDir);
      const endTime = Date.now();

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });
});