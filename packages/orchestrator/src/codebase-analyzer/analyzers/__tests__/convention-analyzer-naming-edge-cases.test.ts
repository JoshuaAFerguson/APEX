/**
 * ConventionAnalyzer Naming Convention Edge Cases Tests
 *
 * Tests for edge cases and complex scenarios in naming convention detection
 * including function, variable, class, constant, and file naming patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Naming Convention Edge Cases', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `naming-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Function Naming Edge Cases', () => {
    it('should handle various function declaration patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const functionPatternsCode = `
// Regular function declarations
function getUserData() { return {}; }
function processPaymentInfo() { return true; }
function validateUserInput() { return false; }

// Arrow functions assigned to const
const handleClick = () => {};
const processData = (data) => data;
const validateForm = async (form) => { return true; };

// Function expressions
const calculateTotal = function(items) { return 0; };
const formatCurrency = function(amount) { return '$' + amount; };

// Async functions
async function fetchUserProfile() { return {}; }
async function updateUserSettings() { return true; }

// Generator functions
function* generateSequence() { yield 1; }
function* processItems() { yield* [1, 2, 3]; }

// Method-like functions
const api = {
  getUsers: function() { return []; },
  createUser: (data) => ({ id: 1, ...data }),
  updateUser: async function(id, data) { return { id, ...data }; }
};

// Higher-order functions
const createValidator = (rules) => (input) => true;
const withAuth = (component) => component;

// Class methods (should not be counted as functions)
class UserService {
  getUserById(id) { return null; }
  createNewUser(data) { return data; }
}
`;

      await fs.writeFile(join(srcDir, 'function-patterns.js'), functionPatternsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
    });

    it('should handle mixed function naming conventions correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedFunctionCode = `
// camelCase functions (should be majority)
function getUserData() {}
function processPayment() {}
function validateInput() {}
function handleSubmit() {}

// snake_case functions (minority)
function get_user_profile() {}
function process_data() {}

// PascalCase functions (minority)
function ProcessOrder() {}

// Some edge cases
function _internalHelper() {}  // Leading underscore
function $jqueryPlugin() {}    // Dollar sign
function __privateMethod() {} // Double underscore
`;

      await fs.writeFile(join(srcDir, 'mixed-functions.js'), mixedFunctionCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase'); // Should detect camelCase as dominant
    });

    it('should handle functions with complex names and numbers', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexNamesCode = `
// camelCase with numbers
function getUserId() {}
function formatV2Response() {}
function processHtml5Data() {}
function handleIE11Compatibility() {}

// snake_case with numbers
function get_user_id() {}
function format_v2_response() {}
function process_html5_data() {}

// Mixed patterns with abbreviations
function parseXMLDocument() {}    // camelCase
function parse_json_data() {}     // snake_case
function validateHTTPRequest() {} // camelCase
function format_url_params() {}   // snake_case

// Edge case names
function a() {}                   // Single letter
function getElementById() {}      // Long name
function i18nTranslate() {}      // Numbers in middle
`;

      await fs.writeFile(join(srcDir, 'complex-names.js'), complexNamesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['camelCase', 'mixed']).toContain(result.functionNaming);
    });

    it('should handle exported function patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const exportedFunctionsCode = `
// Named exports
export function getUserData() {}
export function processPayment() {}
export const validateInput = () => {};
export const handleSubmit = function() {};

// Default exports
export default function createUserService() {}

// Multiple exports
export {
  createUser,
  updateUser,
  deleteUser
};

function createUser() {}
function updateUser() {}
function deleteUser() {}

// Async exports
export async function fetchUserProfile() {}
export const saveUserData = async (data) => {};

// Re-exports (should not count as function declarations)
export { processOrder } from './orders';
export * from './utils';
`;

      await fs.writeFile(join(srcDir, 'exported-functions.js'), exportedFunctionsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.functionNaming).toBe('camelCase');
    });
  });

  describe('Variable Naming Edge Cases', () => {
    it('should distinguish between variables and constants correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const variableVsConstantsCode = `
// Regular variables (camelCase)
const userName = 'john';
const userAge = 25;
const isActive = true;
const userData = {};

// Constants (SCREAMING_SNAKE_CASE) - should be detected as constants, not variables
const API_URL = 'https://api.example.com';
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
const ERROR_CODES = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401
};

// Config-like constants (should be detected as constants)
const maxConnections = 100;    // starts with max
const apiEndpoint = '/api/v1'; // starts with api
const defaultSettings = {};    // starts with default

// Let and var declarations
let currentUser = null;
let isLoading = false;
var globalCounter = 0;
var debugMode = false;

// Destructuring assignments
const { firstName, lastName } = user;
const { data: responseData } = response;
let { status, message } = result;

// Array destructuring
const [first, second] = items;
let [currentItem] = list;
`;

      await fs.writeFile(join(srcDir, 'variables-constants.js'), variableVsConstantsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should handle complex variable assignment patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexAssignmentsCode = `
// Simple assignments
const simpleVar = 'value';
let anotherVar = 42;
var oldStyleVar = true;

// Object destructuring with renaming
const { data: apiData, status: httpStatus } = response;
const { name: userName, age: userAge } = profile;

// Array destructuring
const [firstItem, secondItem, ...restItems] = array;
let [currentIndex] = indices;

// Complex expressions (should still detect variable names)
const calculatedValue = someFunction() + anotherFunction();
const asyncResult = await fetchData();
const conditionalValue = condition ? valueA : valueB;

// Function assignments (should be excluded from variable analysis)
const myFunction = () => {};
const anotherFunction = function() {};
const asyncFunction = async () => {};

// Object method assignments (edge case)
const methods = {
  process: (data) => data,
  validate: function(input) { return true; }
};

// Class assignments
const MyClass = class {};
const UserService = class UserService {};

// Regular expressions and special values
const emailRegex = /^[^@]+@[^@]+$/;
const phonePattern = /^\d{10}$/;
const nullValue = null;
const undefinedValue = undefined;

// Computed property names
const dynamicKey = 'key';
const obj = {
  [dynamicKey]: 'value'
};
`;

      await fs.writeFile(join(srcDir, 'complex-assignments.js'), complexAssignmentsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase');
    });

    it('should handle mixed variable naming conventions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedVariablesCode = `
// Majority camelCase
const userName = 'john';
const userAge = 25;
const isLoggedIn = true;
const userData = {};
const currentPage = 1;

// Some snake_case
const user_profile = {};
const is_admin = false;

// Some PascalCase
const UserSettings = {};
const AppConfig = {};

// Some SCREAMING_SNAKE_CASE (constants)
const MAX_ITEMS = 100;
const API_KEY = 'secret';

// Edge cases
const _private = 'private';
const $element = document.querySelector('div');
const __internal = 'internal';
`;

      await fs.writeFile(join(srcDir, 'mixed-variables.js'), mixedVariablesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.variableNaming).toBe('camelCase'); // Should detect camelCase as dominant
    });
  });

  describe('Class Naming Edge Cases', () => {
    it('should handle various class declaration patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const classPatternsCode = `
// Standard class declarations (PascalCase)
class UserService {}
class PaymentProcessor {}
class DataValidator {}

// Abstract classes
abstract class BaseComponent {}
abstract class AbstractFactory {}

// Class expressions
const MyClass = class {};
const AnotherClass = class AnotherClass {};
const AnonymousClass = class {
  constructor() {}
};

// Exported classes
export class ApiClient {}
export class DatabaseConnection {}
export default class ApplicationService {}

// Classes with generic types
class Container<T> {
  private items: T[] = [];
}

class Repository<TEntity, TKey> {
  findById(id: TKey): TEntity | null { return null; }
}

// Classes with inheritance
class ExtendedUserService extends UserService {}
class CustomPaymentProcessor extends PaymentProcessor {}

// Interface implementations
class UserRepository implements IRepository {}
class ApiService implements IApiService {}

// Decorated classes (TypeScript)
@Injectable()
class ServiceClass {}

@Component({
  selector: 'app-user'
})
class UserComponent {}

// Inner/nested classes
class OuterClass {
  static InnerClass = class {
    constructor() {}
  };
}
`;

      await fs.writeFile(join(srcDir, 'class-patterns.ts'), classPatternsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.classNaming).toBe('PascalCase');
    });

    it('should handle mixed class naming conventions', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedClassesCode = `
// PascalCase classes (should be majority)
class UserService {}
class PaymentProcessor {}
class DataValidator {}
class HttpClient {}

// camelCase classes (minority)
class userRepository {}
class apiClient {}

// snake_case classes (minority)
class data_processor {}
class file_handler {}

// Unusual cases
class _InternalService {}  // Leading underscore
class $JQueryPlugin {}     // Dollar sign
class XMLParser {}         // Abbreviations
class HTMLRenderer {}      // More abbreviations
`;

      await fs.writeFile(join(srcDir, 'mixed-classes.ts'), mixedClassesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.classNaming).toBe('PascalCase'); // Should detect PascalCase as dominant
    });

    it('should handle edge cases with interfaces and types', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const interfaceTypesCode = `
// Classes
class UserService {}
class PaymentService {}

// Interfaces (not counted as classes but may appear in same file)
interface UserInterface {}
interface PaymentInterface {}

// Types (not counted as classes)
type UserType = {
  id: number;
  name: string;
};

type PaymentType = {
  amount: number;
  currency: string;
};

// Enums (not counted as classes)
enum UserStatus {
  Active,
  Inactive,
  Pending
}

enum PaymentMethod {
  CreditCard,
  PayPal,
  BankTransfer
}

// More classes to ensure class detection works
class DataRepository {}
class EventHandler {}
`;

      await fs.writeFile(join(srcDir, 'interfaces-types.ts'), interfaceTypesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.classNaming).toBe('PascalCase');
    });
  });

  describe('File Naming Edge Cases', () => {
    it('should handle various file naming patterns', async () => {
      const srcDir = join(testDir, 'src');
      const componentsDir = join(srcDir, 'components');
      const utilsDir = join(srcDir, 'utils');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(componentsDir, { recursive: true });
      await fs.mkdir(utilsDir, { recursive: true });

      // Create files with different naming conventions
      await fs.writeFile(join(srcDir, 'userService.js'), 'export class UserService {}'); // camelCase
      await fs.writeFile(join(srcDir, 'paymentProcessor.ts'), 'export class PaymentProcessor {}'); // camelCase
      await fs.writeFile(join(srcDir, 'dataValidator.tsx'), 'export const DataValidator = () => {};'); // camelCase

      await fs.writeFile(join(componentsDir, 'UserProfile.jsx'), 'export const UserProfile = () => {};'); // PascalCase
      await fs.writeFile(join(componentsDir, 'PaymentForm.tsx'), 'export const PaymentForm = () => {};'); // PascalCase

      await fs.writeFile(join(utilsDir, 'string-utils.js'), 'export const capitalize = () => {};'); // kebab-case
      await fs.writeFile(join(utilsDir, 'date-helpers.ts'), 'export const formatDate = () => {};'); // kebab-case

      await fs.writeFile(join(srcDir, 'api_client.js'), 'export class ApiClient {}'); // snake_case
      await fs.writeFile(join(srcDir, 'config_loader.ts'), 'export const loadConfig = () => {};'); // snake_case

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'camelCase', 'kebab-case', 'PascalCase']).toContain(result.fileNaming);
    });

    it('should handle files with special characters and patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create files with various patterns
      await fs.writeFile(join(srcDir, 'user.service.js'), 'export class UserService {}'); // Dot notation
      await fs.writeFile(join(srcDir, 'payment.service.ts'), 'export class PaymentService {}'); // Dot notation
      await fs.writeFile(join(srcDir, 'data.validator.js'), 'export class DataValidator {}'); // Dot notation

      await fs.writeFile(join(srcDir, 'user-profile.component.tsx'), 'export const UserProfile = () => {};'); // Compound naming
      await fs.writeFile(join(srcDir, 'payment-form.component.jsx'), 'export const PaymentForm = () => {};'); // Compound naming

      await fs.writeFile(join(srcDir, 'api_v1.js'), 'export const api = {};'); // snake_case with version
      await fs.writeFile(join(srcDir, 'config_v2.ts'), 'export const config = {};'); // snake_case with version

      await fs.writeFile(join(srcDir, 'UserService.spec.js'), 'describe("UserService", () => {});'); // Test files
      await fs.writeFile(join(srcDir, 'PaymentService.test.ts'), 'test("PaymentService", () => {});'); // Test files

      await fs.writeFile(join(srcDir, 'README.md'), '# Documentation'); // Documentation files
      await fs.writeFile(join(srcDir, 'CHANGELOG.md'), '# Changes'); // Documentation files

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'kebab-case', 'snake_case', 'PascalCase']).toContain(result.fileNaming);
    });

    it('should ignore common non-source files in naming analysis', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create source files with consistent naming
      await fs.writeFile(join(srcDir, 'userService.js'), 'export class UserService {}');
      await fs.writeFile(join(srcDir, 'paymentService.ts'), 'export class PaymentService {}');
      await fs.writeFile(join(srcDir, 'dataService.jsx'), 'export class DataService {}');

      // Create non-source files (should not affect analysis significantly)
      await fs.writeFile(join(testDir, 'package.json'), '{"name": "test"}');
      await fs.writeFile(join(testDir, '.gitignore'), 'node_modules/');
      await fs.writeFile(join(testDir, 'README.md'), '# Test Project');
      await fs.writeFile(join(testDir, '.eslintrc.js'), 'module.exports = {};');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.fileNaming).toBe('camelCase'); // Should be determined by source files
    });
  });

  describe('Constant Naming Detection', () => {
    it('should detect various constant patterns correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const constantsCode = `
// Classic SCREAMING_SNAKE_CASE constants
const API_URL = 'https://api.example.com';
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
const ERROR_MESSAGES = {
  NOT_FOUND: 'Not found',
  UNAUTHORIZED: 'Unauthorized'
};

// Single word constants
const PORT = 3000;
const DEBUG = true;
const VERSION = '1.0.0';

// Constants with prefixes that indicate constant nature
const maxConnections = 100;
const minRetryDelay = 1000;
const defaultConfiguration = {};
const apiBaseUrl = 'https://api.example.com';
const keyVaultSecret = 'secret';
const configTimeout = 30000;
const limitMaxSize = 1024;

// Regular variables (should not be detected as constants)
const userName = 'john';
const userData = {};
const isActive = true;
const components = [];

// Functions (should not be detected as constants)
const processData = () => {};
const validateInput = (input) => input;

// Edge cases - config-like patterns
const urlPattern = /^https?:/;
const secretKey = 'abc123';
const timeoutValue = 5000;
`;

      await fs.writeFile(join(srcDir, 'constants.js'), constantsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should handle mixed constant naming patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedConstantsCode = `
// SCREAMING_SNAKE_CASE constants (majority)
const API_URL = 'https://api.example.com';
const MAX_ITEMS = 100;
const DEFAULT_CONFIG = {};
const ERROR_CODES = [400, 401, 403];

// camelCase constants (minority)
const maxRetries = 3;
const apiTimeout = 5000;
const defaultSettings = {};

// PascalCase constants (minority)
const DefaultConfiguration = {};
const ApiEndpoints = {};

// Regular variables (should not count towards constants)
const userName = 'user';
const currentPage = 1;
const isLoading = false;
`;

      await fs.writeFile(join(srcDir, 'mixed-constants.js'), mixedConstantsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should return undefined when no constants are detected', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noConstantsCode = `
// Only regular variables and functions
const userName = 'john';
const userData = {};
const isActive = true;
const currentPage = 1;

let counter = 0;
var globalFlag = false;

function processData() {}
const handleClick = () => {};

class UserService {}

const regularObject = {
  property: 'value'
};
`;

      await fs.writeFile(join(srcDir, 'no-constants.js'), noConstantsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.constantNaming).toBeUndefined();
    });
  });

  describe('Complex Mixed Patterns', () => {
    it('should handle files with all naming patterns together', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const allPatternsCode = `
// File: userManagement.js (camelCase file)

// Constants
const API_BASE_URL = 'https://api.example.com';
const MAX_USERS_PER_PAGE = 50;
const DEFAULT_USER_ROLE = 'user';
const minPasswordLength = 8; // camelCase constant

// Variables
const currentUser = null;
const userList = [];
const isLoading = false;
const user_cache = new Map(); // snake_case variable

// Functions
function getUserById(id) { return null; }
function createNewUser(data) { return data; }
function validateUserData(data) { return true; }
const processUserUpdate = (user) => user; // camelCase arrow function
function get_user_permissions() { return []; } // snake_case function

// Classes
class UserService {
  constructor() {}

  getUser(id) { return null; }
  createUser(data) { return data; }
}

class user_repository { // snake_case class
  findById(id) { return null; }
}

class DataProcessor { // PascalCase class
  process(data) { return data; }
}

// Export
export { UserService, user_repository, DataProcessor };
`;

      await fs.writeFile(join(srcDir, 'userManagement.js'), allPatternsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect dominant patterns for each category
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(['PascalCase', 'mixed']).toContain(result.classNaming || 'mixed');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should handle inconsistent patterns correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const inconsistentCode = `
// Equal distribution should result in 'mixed' or 'inconsistent'
function camelCaseFunc() {}
function snake_case_func() {}
function PascalCaseFunc() {}
function another_snake() {}
function anotherCamel() {}
function AnotherPascal() {}

const camelVar = 1;
const snake_var = 2;
const PascalVar = 3;
const another_snake_var = 4;
const anotherCamelVar = 5;
const AnotherPascalVar = 6;

class CamelClass {}
class snake_class {}
class PascalClass {}
`;

      // Create multiple files with inconsistent patterns
      await fs.writeFile(join(srcDir, 'inconsistent.js'), inconsistentCode);

      // Files with different naming conventions
      await fs.writeFile(join(srcDir, 'camel-case-file.js'), 'function camelFunc() {}');
      await fs.writeFile(join(srcDir, 'snake_case_file.js'), 'function snake_func() {}');
      await fs.writeFile(join(srcDir, 'PascalCaseFile.js'), 'function PascalFunc() {}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed or inconsistent patterns
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(result.variableNaming);
      expect(['mixed', 'inconsistent', undefined]).toContain(result.classNaming);
      expect(['mixed', 'kebab-case', 'snake_case', 'inconsistent']).toContain(result.fileNaming);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should always return valid enum values', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create minimal content that exercises all naming detection
      await fs.writeFile(join(srcDir, 'test-file.js'), `
const API_KEY = 'key';
const userName = 'user';
function getUserData() { return {}; }
class UserService {}
export default UserService;
`);

      const result = await analyzer.analyze(testDir);

      // Should not throw on schema validation
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // All naming fields should have valid enum values
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

    it('should handle empty project gracefully', async () => {
      // Empty project directory
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should return valid default values
      expect(result.fileNaming).toBe('mixed');
      expect(result.functionNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
      expect(result.classNaming).toBeUndefined();
      expect(result.constantNaming).toBeUndefined();
    });
  });
});