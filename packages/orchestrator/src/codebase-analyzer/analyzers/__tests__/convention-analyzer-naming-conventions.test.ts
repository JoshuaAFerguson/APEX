/**
 * ConventionAnalyzer Naming Convention Detection Tests
 *
 * Comprehensive tests for the naming convention detection feature specifically
 * validating camelCase, PascalCase, snake_case, and SCREAMING_SNAKE_CASE patterns.
 *
 * These tests fulfill the acceptance criteria:
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

describe('ConventionAnalyzer - Naming Convention Detection', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-naming-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('camelCase Pattern Detection', () => {
    it('should detect camelCase file naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create files with consistent camelCase naming
      const camelCaseFiles = [
        { name: 'userService.ts', content: 'export const service = {};' },
        { name: 'orderController.ts', content: 'export const controller = {};' },
        { name: 'productModel.ts', content: 'export const model = {};' },
        { name: 'stringHelper.ts', content: 'export const helper = {};' },
        { name: 'dataProcessor.ts', content: 'export const processor = {};' }
      ];

      for (const file of camelCaseFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('camelCase');
    });

    it('should detect camelCase function naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const camelCaseFunctions = `
export function getUserData() {
  return {};
}

export function processOrder() {
  return {};
}

export function validateInput() {
  return true;
}

export function calculateTotal() {
  return 0;
}

export function formatResponse() {
  return '';
}

const createUser = () => {};
const updatePassword = () => {};
const deleteAccount = () => {};
      `;

      await fs.writeFile(join(srcDir, 'functions.ts'), camelCaseFunctions);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
    });

    it('should detect camelCase variable naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const camelCaseVariables = `
const userName = 'john';
const userAge = 25;
const orderTotal = 100.50;
const isActive = true;
const itemCount = 5;
const lastModified = new Date();
let currentUser = null;
let selectedItems = [];
var defaultTimeout = 5000;
var maxRetries = 3;
      `;

      await fs.writeFile(join(srcDir, 'variables.ts'), camelCaseVariables);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should detect camelCase mixed with appropriate constants', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedCode = `
// camelCase variables
const userName = 'john';
const orderTotal = 100.50;
let currentUser = null;

// SCREAMING_SNAKE_CASE constants
const MAX_USERS = 1000;
const API_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 3;

// camelCase functions
export function getUserData() {
  return {};
}

export function processOrder() {
  return {};
}

// PascalCase classes
export class UserService {
  constructor() {}
}

export class OrderProcessor {
  process() {}
}
      `;

      await fs.writeFile(join(srcDir, 'mixed.ts'), mixedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });
  });

  describe('PascalCase Pattern Detection', () => {
    it('should detect PascalCase file naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const pascalCaseFiles = [
        { name: 'UserService.ts', content: 'export class UserService {}' },
        { name: 'OrderController.ts', content: 'export class OrderController {}' },
        { name: 'ProductModel.ts', content: 'export class ProductModel {}' },
        { name: 'StringHelper.ts', content: 'export class StringHelper {}' },
        { name: 'DataProcessor.ts', content: 'export class DataProcessor {}' }
      ];

      for (const file of pascalCaseFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('PascalCase');
    });

    it('should detect PascalCase function naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const pascalCaseFunctions = `
export function GetUserData() {
  return {};
}

export function ProcessOrder() {
  return {};
}

export function ValidateInput() {
  return true;
}

export function CalculateTotal() {
  return 0;
}

export function FormatResponse() {
  return '';
}

const CreateUser = () => {};
const UpdatePassword = () => {};
const DeleteAccount = () => {};
      `;

      await fs.writeFile(join(srcDir, 'functions.ts'), pascalCaseFunctions);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('PascalCase');
    });

    it('should detect PascalCase class naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const pascalCaseClasses = `
export class UserService {
  constructor() {}

  getUserData() {
    return {};
  }
}

export class OrderController {
  constructor() {}

  processOrder() {
    return {};
  }
}

export class ProductModel {
  constructor() {}

  validate() {
    return true;
  }
}

export class StringHelper {
  static format(text: string) {
    return text;
  }
}

export class DataProcessor {
  process(data: any) {
    return data;
  }
}
      `;

      await fs.writeFile(join(srcDir, 'classes.ts'), pascalCaseClasses);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.classNaming).toBe('PascalCase');
    });
  });

  describe('snake_case Pattern Detection', () => {
    it('should detect snake_case file naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const snakeCaseFiles = [
        { name: 'user_service.py', content: 'def get_user(): pass' },
        { name: 'order_controller.py', content: 'def process_order(): pass' },
        { name: 'product_model.py', content: 'def validate_product(): pass' },
        { name: 'string_helper.py', content: 'def format_string(): pass' },
        { name: 'data_processor.py', content: 'def process_data(): pass' }
      ];

      for (const file of snakeCaseFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('snake_case');
    });

    it('should detect snake_case function naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true});

      const snakeCaseFunctions = `
export function get_user_data() {
  return {};
}

export function process_order() {
  return {};
}

export function validate_input() {
  return true;
}

export function calculate_total() {
  return 0;
}

export function format_response() {
  return '';
}

const create_user = () => {};
const update_password = () => {};
const delete_account = () => {};
      `;

      await fs.writeFile(join(srcDir, 'functions.js'), snakeCaseFunctions);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('snake_case');
    });

    it('should detect snake_case variable naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const snakeCaseVariables = `
const user_name = 'john';
const user_age = 25;
const order_total = 100.50;
const is_active = true;
const item_count = 5;
const last_modified = new Date();
let current_user = null;
let selected_items = [];
var default_timeout = 5000;
var max_retries = 3;
      `;

      await fs.writeFile(join(srcDir, 'variables.js'), snakeCaseVariables);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('snake_case');
    });

    it('should detect snake_case class naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const snakeCaseClasses = `
export class user_service {
  constructor() {}

  get_user_data() {
    return {};
  }
}

export class order_controller {
  constructor() {}

  process_order() {
    return {};
  }
}

export class product_model {
  constructor() {}

  validate() {
    return true;
  }
}
      `;

      await fs.writeFile(join(srcDir, 'classes.js'), snakeCaseClasses);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.classNaming).toBe('snake_case');
    });
  });

  describe('SCREAMING_SNAKE_CASE Pattern Detection', () => {
    it('should detect SCREAMING_SNAKE_CASE constant naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const screamingSnakeConstants = `
const MAX_USERS = 1000;
const API_TIMEOUT = 30000;
const DEFAULT_RETRY_COUNT = 3;
const DATABASE_URL = 'http://localhost:5432';
const SECRET_KEY = 'super-secret';
const CACHE_EXPIRY_TIME = 3600;
const MAX_FILE_SIZE = 1024 * 1024;
const ERROR_CODES = {
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};
      `;

      await fs.writeFile(join(srcDir, 'constants.ts'), screamingSnakeConstants);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should detect SCREAMING_SNAKE_CASE variable naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const screamingSnakeVariables = `
const USER_NAME = 'JOHN';
const USER_AGE = 25;
const ORDER_TOTAL = 100.50;
const IS_ACTIVE = true;
const ITEM_COUNT = 5;
const LAST_MODIFIED = new Date();
let CURRENT_USER = null;
let SELECTED_ITEMS = [];
var DEFAULT_TIMEOUT = 5000;
var MAX_RETRIES = 3;
      `;

      await fs.writeFile(join(srcDir, 'variables.js'), screamingSnakeVariables);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('SCREAMING_SNAKE_CASE');
    });
  });

  describe('Mixed and Edge Case Pattern Detection', () => {
    it('should detect mixed naming patterns when conventions are inconsistent', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedFiles = [
        { name: 'camelCaseFile.ts', content: 'export const test = 1;' },
        { name: 'PascalCaseFile.ts', content: 'export const test = 2;' },
        { name: 'snake_case_file.py', content: 'def test(): pass' },
        { name: 'kebab-case-file.js', content: 'export const test = 4;' }
      ];

      for (const file of mixedFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
    });

    it('should detect mixed function naming patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedFunctions = `
// Mix of camelCase and snake_case functions
export function getUserData() {
  return {};
}

export function get_user_profile() {
  return {};
}

export function ProcessOrder() {
  return {};
}

export function calculate_total() {
  return 0;
}

const createUser = () => {};
const delete_account = () => {};
      `;

      await fs.writeFile(join(srcDir, 'functions.ts'), mixedFunctions);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
    });

    it('should handle single character names', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const singleCharCode = `
export function a() { return 'a'; }
export function b() { return 'b'; }
export function c() { return 'c'; }
const x = 1;
const y = 2;
const z = 3;
export class A {}
export class B {}
      `;

      await fs.writeFile(join(srcDir, 'single.ts'), singleCharCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      // Single character names should be detected as camelCase
      expect(['camelCase', 'mixed']).toContain(result.functionNaming);
      expect(['camelCase', 'mixed']).toContain(result.variableNaming);
      expect(['PascalCase', 'mixed']).toContain(result.classNaming);
    });

    it('should handle names with numbers', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const numberedCode = `
export function getUser2Data() { return {}; }
export function processOrder3() { return {}; }
export function validateInput1() { return true; }
const user2Name = 'john';
const order3Total = 100;
const item1Count = 5;
export class User2Service {}
export class Order3Controller {}
const MAX_USERS_2 = 1000;
const API_TIMEOUT_3 = 30000;
      `;

      await fs.writeFile(join(srcDir, 'numbered.ts'), numberedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should handle very long names', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const longNamesCode = `
export function getUserDataFromDatabaseWithCachingAndValidation() {
  return {};
}

export function processOrderAndSendEmailNotificationToCustomer() {
  return {};
}

const veryLongVariableNameThatDescribesExactlyWhatItContains = 'data';
const anotherVeryLongVariableNameForStoringUserInformation = {};

export class VeryLongClassNameThatDescribesTheExactPurposeOfThisService {
  constructor() {}
}

const VERY_LONG_CONSTANT_NAME_FOR_MAXIMUM_NUMBER_OF_USERS_ALLOWED = 1000;
      `;

      await fs.writeFile(join(srcDir, 'long-names.ts'), longNamesCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should handle files with no identifiers', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const emptyFile = `
// This file has no functions, variables, or classes
// Just comments and imports
import { something } from './other';
      `;

      await fs.writeFile(join(srcDir, 'empty.ts'), emptyFile);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
      expect(result.classNaming).toBeUndefined();
      expect(result.constantNaming).toBeUndefined();
    });
  });

  describe('Statistical Accuracy Tests', () => {
    it('should correctly identify dominant patterns with 60%+ threshold', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // 60% camelCase, 40% snake_case functions - should detect camelCase
      const dominantCamelCase = `
// camelCase functions (6 total = 60%)
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return true; }
export function calculateTotal() { return 0; }
export function formatResponse() { return ''; }
export function createSession() { return null; }

// snake_case functions (4 total = 40%)
export function get_user_profile() { return {}; }
export function delete_account() { return {}; }
export function update_password() { return {}; }
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

    it('should detect inconsistent patterns when secondary pattern is significant', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // 55% camelCase, 35% snake_case, 10% PascalCase - should detect inconsistent
      const inconsistentPattern = `
// camelCase functions (55%)
export function getUserData() { return {}; }
export function processOrder() { return {}; }
export function validateInput() { return true; }
export function calculateTotal() { return 0; }
export function formatResponse() { return ''; }
export function createSession() { return null; }

// snake_case functions (35%)
export function get_user_profile() { return {}; }
export function delete_account() { return {}; }
export function update_password() { return {}; }
export function send_notification() { return {}; }

// PascalCase functions (10%)
export function ProcessData() { return {}; }
      `;

      await fs.writeFile(join(srcDir, 'inconsistent.ts'), inconsistentPattern);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['inconsistent', 'mixed']).toContain(result.functionNaming);
    });
  });

  describe('Real-world Pattern Simulation', () => {
    it('should detect typical JavaScript project conventions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typicalJSProject = `
// Typical JavaScript/TypeScript conventions
import { logger } from './utils/logger';
import { config } from './config';

const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;

export class UserService {
  private baseUrl: string;
  private retryCount: number;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.retryCount = MAX_RETRY_ATTEMPTS;
  }

  async getUserById(userId: string) {
    const url = \`\${this.baseUrl}/users/\${userId}\`;
    return this.makeRequest(url);
  }

  async createUser(userData: any) {
    return this.makeRequest(\`\${this.baseUrl}/users\`, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  private async makeRequest(url: string, options?: any) {
    const requestId = Math.random().toString(36);
    const startTime = Date.now();

    try {
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      logger.info('Request completed', {
        requestId,
        url,
        responseTime,
        status: response.status
      });

      return await response.json();
    } catch (error) {
      const errorTime = Date.now() - startTime;

      logger.error('Request failed', {
        requestId,
        url,
        errorTime,
        error: error.message
      });

      throw error;
    }
  }
}
      `;

      await fs.writeFile(join(srcDir, 'userService.ts'), typicalJSProject);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should detect typical Python project conventions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typicalPythonProject = `
"""
Typical Python project conventions
"""
import json
import logging
from typing import Optional, Dict, Any

API_BASE_URL = 'https://api.example.com'
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT = 5000

logger = logging.getLogger(__name__)

class user_service:
    def __init__(self):
        self.base_url = API_BASE_URL
        self.retry_count = MAX_RETRY_ATTEMPTS

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/users/{user_id}"
        return self._make_request(url)

    def create_user(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self._make_request(f"{self.base_url}/users", {
            'method': 'POST',
            'data': json.dumps(user_data)
        })

    def _make_request(self, url: str, options: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        request_id = str(random.randint(1000, 9999))
        start_time = time.time()

        try:
            response = requests.get(url, **(options or {}))
            response_time = time.time() - start_time

            logger.info('Request completed', extra={
                'request_id': request_id,
                'url': url,
                'response_time': response_time,
                'status': response.status_code
            })

            return response.json()
        except Exception as error:
            error_time = time.time() - start_time

            logger.error('Request failed', extra={
                'request_id': request_id,
                'url': url,
                'error_time': error_time,
                'error': str(error)
            })

            raise error
      `;

      await fs.writeFile(join(srcDir, 'user_service.py'), typicalPythonProject);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('snake_case');
      expect(result.functionNaming).toBe('snake_case');
      expect(result.variableNaming).toBe('snake_case');
      expect(result.classNaming).toBe('snake_case');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });
  });

  describe('Schema Compliance Validation', () => {
    it('should always return schema-compliant results for any naming pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const chaosCode = `
// Complete chaos of naming conventions
export function weirdMix() { return 1; }
export function WEIRD_MIX_2() { return 2; }
export function WeirdMix3() { return 3; }
export function weird_mix_4() { return 4; }

const normalVar = 1;
const WEIRD_VAR = 2;
const WeirdVar = 3;
const weird_var = 4;

export class NormalClass {}
export class WEIRD_CLASS {}
export class weird_class {}

const NORMAL_CONST = 1;
const weirdConst = 2;
const WeirdConst = 3;
const weird_const = 4;
      `;

      await fs.writeFile(join(srcDir, 'chaos.ts'), chaosCode);

      const result = await analyzer.analyze(testDir);

      // Must pass schema validation regardless of chaos
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed/inconsistent patterns
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(result.variableNaming);
      expect(['mixed', 'inconsistent']).toContain(result.classNaming);
      expect(['mixed', 'inconsistent']).toContain(result.constantNaming);
    });

    it('should validate all enum values are within schema constraints', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create minimal valid file
      await fs.writeFile(join(srcDir, 'test.ts'), 'export const test = 1;');

      const result = await analyzer.analyze(testDir);
      const parsed = ConventionAnalysisSchema.parse(result);

      // Validate all enum values are within expected ranges
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.fileNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.functionNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']).toContain(parsed.variableNaming);

      if (parsed.classNaming !== undefined) {
        expect(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.classNaming);
      }

      if (parsed.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(parsed.constantNaming);
      }
    });
  });
});