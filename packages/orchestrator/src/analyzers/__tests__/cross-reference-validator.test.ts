/**
 * CrossReferenceValidator Tests
 *
 * Comprehensive test suite for the CrossReferenceValidator class, testing:
 * - Symbol extraction from TypeScript/JavaScript files
 * - Documentation reference extraction
 * - Cross-reference validation and broken link detection
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrossReferenceValidator } from '../cross-reference-validator';
import type { SymbolIndex, DocumentationReference, SymbolInfo } from '../cross-reference-validator';
import type { OutdatedDocumentation } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module for controlled testing
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('CrossReferenceValidator', () => {
  let validator: CrossReferenceValidator;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Symbol Extraction Tests
  // ============================================================================

  describe('symbol extraction', () => {
    it('should extract exported functions correctly', () => {
      const content = `
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export async function fetchUserData(userId: string): Promise<User> {
  return await api.get(\`/users/\${userId}\`);
}
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);
      const functions = symbols.filter(s => s.type === 'function');

      expect(functions).toHaveLength(2);

      const calculateTotal = functions.find(s => s.name === 'calculateTotal');
      expect(calculateTotal).toBeDefined();
      expect(calculateTotal?.isExported).toBe(true);
      expect(calculateTotal?.line).toBe(2);

      const fetchUserData = functions.find(s => s.name === 'fetchUserData');
      expect(fetchUserData).toBeDefined();
      expect(fetchUserData?.isExported).toBe(true);
      expect(fetchUserData?.line).toBe(6);
    });

    it('should extract non-exported functions correctly', () => {
      const content = `
function helper(value: string): string {
  return value.trim();
}

async function processData(data: any[]): Promise<void> {
  // Process data
}
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);
      const functions = symbols.filter(s => s.type === 'function');

      expect(functions).toHaveLength(2);
      functions.forEach(func => {
        expect(func.isExported).toBe(false);
      });
    });

    it('should extract arrow functions correctly', () => {
      const content = `
export const multiply = (a: number, b: number): number => a * b;

const divide = (a: number, b: number): number => a / b;

export const asyncOperation = async (id: string) => {
  return await fetch(\`/api/\${id}\`);
};
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);
      const functions = symbols.filter(s => s.type === 'function');

      expect(functions).toHaveLength(3);

      const multiply = functions.find(s => s.name === 'multiply');
      expect(multiply?.isExported).toBe(true);

      const divide = functions.find(s => s.name === 'divide');
      expect(divide?.isExported).toBe(false);

      const asyncOperation = functions.find(s => s.name === 'asyncOperation');
      expect(asyncOperation?.isExported).toBe(true);
    });

    it('should extract classes and their members correctly', () => {
      const content = `
export class UserService {
  private apiKey: string;
  public baseUrl: string = 'https://api.example.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async getUser(id: string): Promise<User> {
    return await this.fetch(\`/users/\${id}\`);
  }

  private async fetch(endpoint: string): Promise<any> {
    // Implementation
  }
}

class InternalService {
  public process(): void {
    // Implementation
  }
}
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);

      const classes = symbols.filter(s => s.type === 'class');
      expect(classes).toHaveLength(2);

      const userService = classes.find(s => s.name === 'UserService');
      expect(userService?.isExported).toBe(true);

      const internalService = classes.find(s => s.name === 'InternalService');
      expect(internalService?.isExported).toBe(false);

      const methods = symbols.filter(s => s.type === 'method');
      expect(methods.length).toBeGreaterThan(0);

      const properties = symbols.filter(s => s.type === 'property');
      expect(properties.length).toBeGreaterThan(0);

      // Check parent references
      const getUserMethod = methods.find(s => s.name === 'getUser');
      expect(getUserMethod?.parent).toBe('UserService');

      const apiKeyProperty = properties.find(s => s.name === 'apiKey');
      expect(apiKeyProperty?.parent).toBe('UserService');
    });

    it('should extract interfaces and types correctly', () => {
      const content = `
export interface User {
  id: string;
  name: string;
  email: string;
}

interface InternalConfig {
  debug: boolean;
}

export type ResponseStatus = 'success' | 'error' | 'pending';

type InternalType = {
  value: number;
};

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);

      const interfaces = symbols.filter(s => s.type === 'interface');
      expect(interfaces).toHaveLength(2);

      const user = interfaces.find(s => s.name === 'User');
      expect(user?.isExported).toBe(true);

      const config = interfaces.find(s => s.name === 'InternalConfig');
      expect(config?.isExported).toBe(false);

      const types = symbols.filter(s => s.type === 'type');
      expect(types).toHaveLength(2);

      const responseStatus = types.find(s => s.name === 'ResponseStatus');
      expect(responseStatus?.isExported).toBe(true);

      const enums = symbols.filter(s => s.type === 'enum');
      expect(enums).toHaveLength(1);

      const userRole = enums.find(s => s.name === 'UserRole');
      expect(userRole?.isExported).toBe(true);
    });

    it('should extract constants and variables correctly', () => {
      const content = `
export const API_BASE_URL = 'https://api.example.com';
const INTERNAL_CONFIG = { debug: true };

export let globalCounter = 0;
var legacyVariable = 'legacy';
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);

      const constants = symbols.filter(s => s.type === 'const' || s.type === 'variable');
      expect(constants.length).toBeGreaterThan(0);

      const apiUrl = constants.find(s => s.name === 'API_BASE_URL');
      expect(apiUrl?.isExported).toBe(true);
      expect(apiUrl?.type).toBe('const');

      const config = constants.find(s => s.name === 'INTERNAL_CONFIG');
      expect(config?.isExported).toBe(false);
      expect(config?.type).toBe('const');

      const counter = constants.find(s => s.name === 'globalCounter');
      expect(counter?.isExported).toBe(true);
      expect(counter?.type).toBe('variable');
    });

    it('should handle JSDoc comments correctly', () => {
      const content = `
/**
 * Calculates the total price of items
 * @param items Array of items to calculate
 * @returns Total price
 */
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

/**
 * User service class
 * Handles all user-related operations
 */
export class UserService {
  /**
   * Gets user by ID
   * @param id User identifier
   */
  public getUser(id: string): Promise<User> {
    return fetch(\`/users/\${id}\`);
  }
}
`;

      const symbols = validator.extractSymbols('/test/file.ts', content);

      const calculateTotal = symbols.find(s => s.name === 'calculateTotal');
      expect(calculateTotal?.documentation).toBeDefined();
      expect(calculateTotal?.documentation).toContain('Calculates the total price');

      const userService = symbols.find(s => s.name === 'UserService');
      expect(userService?.documentation).toBeDefined();
      expect(userService?.documentation).toContain('User service class');
    });

    it('should respect includePrivate and includeMembers options', () => {
      const content = `
export function publicFunction(): void {}
function privateFunction(): void {}

export class TestClass {
  public publicMethod(): void {}
  private privateMethod(): void {}
  public property: string = 'test';
}
`;

      // Test includePrivate = false (default)
      const symbolsNoPrivate = validator.extractSymbols('/test/file.ts', content, false, true);
      const privateFunc = symbolsNoPrivate.find(s => s.name === 'privateFunction');
      expect(privateFunc).toBeUndefined();

      // Test includePrivate = true
      const symbolsWithPrivate = validator.extractSymbols('/test/file.ts', content, true, true);
      const privateFuncIncluded = symbolsWithPrivate.find(s => s.name === 'privateFunction');
      expect(privateFuncIncluded).toBeDefined();

      // Test includeMembers = false
      const symbolsNoMembers = validator.extractSymbols('/test/file.ts', content, false, false);
      const method = symbolsNoMembers.find(s => s.type === 'method');
      const property = symbolsNoMembers.find(s => s.type === 'property');
      expect(method).toBeUndefined();
      expect(property).toBeUndefined();
    });
  });

  // ============================================================================
  // Documentation Reference Extraction Tests
  // ============================================================================

  describe('documentation reference extraction', () => {
    it('should extract inline code references correctly', () => {
      const content = `
# API Documentation

Use the \`calculateTotal()\` function to compute totals.
The \`UserService\` class provides user operations.
Call \`fetchUserData()\` to retrieve user information.

See the \`Config\` interface for configuration options.
`;

      const references = validator.extractInlineCodeReferences('/docs/api.md', content);

      expect(references).toHaveLength(4);

      const calculateTotalRef = references.find(r => r.symbolName === 'calculateTotal');
      expect(calculateTotalRef).toBeDefined();
      expect(calculateTotalRef?.referenceType).toBe('inline-code');
      expect(calculateTotalRef?.line).toBe(4);

      const userServiceRef = references.find(r => r.symbolName === 'UserService');
      expect(userServiceRef).toBeDefined();

      const configRef = references.find(r => r.symbolName === 'Config');
      expect(configRef).toBeDefined();
    });

    it('should extract code block references correctly', () => {
      const content = `
## Usage Example

\`\`\`typescript
import { UserService, calculateTotal } from './lib';

const service = new UserService('api-key');
const user = await service.getUser('123');
const total = calculateTotal(items);
\`\`\`

\`\`\`javascript
const result = processData(inputData);
console.log(result);
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('/docs/usage.md', content);

      expect(references.length).toBeGreaterThan(0);

      const serviceRef = references.find(r => r.symbolName === 'UserService');
      expect(serviceRef).toBeDefined();
      expect(serviceRef?.referenceType).toBe('code-block');

      const calculateTotalRef = references.find(r => r.symbolName === 'calculateTotal');
      expect(calculateTotalRef).toBeDefined();

      const processDataRef = references.find(r => r.symbolName === 'processData');
      expect(processDataRef).toBeDefined();
    });

    it('should extract @see tag references correctly', () => {
      const content = `
/**
 * User authentication service
 * @see UserService for user management
 * @see {validateToken} for token validation
 * @see AuthConfig.timeout for timeout settings
 */
export class AuthService {
  /**
   * Login method
   * @see AuthValidator.validate
   * @see {logout}
   */
  public login(credentials: Credentials): Promise<Session> {
    // Implementation
  }
}
`;

      const references = validator.extractSeeTagReferences('/src/auth.ts', content);

      expect(references.length).toBeGreaterThan(0);

      const userServiceRef = references.find(r => r.symbolName === 'UserService');
      expect(userServiceRef).toBeDefined();
      expect(userServiceRef?.referenceType).toBe('see-tag');

      const validateTokenRef = references.find(r => r.symbolName === 'validateToken');
      expect(validateTokenRef).toBeDefined();

      // Should handle dotted references by extracting the last part
      const timeoutRef = references.find(r => r.symbolName === 'timeout');
      expect(timeoutRef).toBeDefined();
    });

    it('should extract all reference types from documentation', () => {
      const content = `
# User Management API

Use the \`UserService\` class for user operations.

## Example

\`\`\`typescript
const service = new UserService();
const user = await service.getUser('123');
\`\`\`

/**
 * @see validateUser for validation
 */
`;

      const references = validator.extractDocumentationReferences('/docs/users.md', content);

      expect(references.length).toBeGreaterThan(0);

      const inlineRefs = references.filter(r => r.referenceType === 'inline-code');
      const codeBlockRefs = references.filter(r => r.referenceType === 'code-block');
      const seeTagRefs = references.filter(r => r.referenceType === 'see-tag');

      expect(inlineRefs.length).toBeGreaterThan(0);
      expect(codeBlockRefs.length).toBeGreaterThan(0);
      expect(seeTagRefs.length).toBeGreaterThan(0);
    });

    it('should filter out common JavaScript built-ins', () => {
      const content = `
\`\`\`javascript
console.log('Hello');
setTimeout(callback, 1000);
const data = JSON.parse(response);
Promise.resolve(value);
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('/docs/example.md', content);

      // Should not include built-in functions
      const consoleRef = references.find(r => r.symbolName === 'console');
      const setTimeoutRef = references.find(r => r.symbolName === 'setTimeout');
      const jsonRef = references.find(r => r.symbolName === 'JSON');
      const promiseRef = references.find(r => r.symbolName === 'Promise');

      expect(consoleRef).toBeUndefined();
      expect(setTimeoutRef).toBeUndefined();
      expect(jsonRef).toBeUndefined();
      expect(promiseRef).toBeUndefined();
    });
  });

  // ============================================================================
  // Symbol Index Building Tests
  // ============================================================================

  describe('symbol index building', () => {
    beforeEach(() => {
      // Mock file system operations
      mockFs.readdir.mockImplementation(async (dirPath: any, options?: any) => {
        if (dirPath.includes('src')) {
          return [
            { name: 'index.ts', isFile: () => true, isDirectory: () => false },
            { name: 'service.ts', isFile: () => true, isDirectory: () => false },
            { name: 'utils', isFile: () => false, isDirectory: () => true },
          ] as any;
        }
        if (dirPath.includes('utils')) {
          return [
            { name: 'helpers.ts', isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        return [];
      });

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('index.ts')) {
          return 'export function main(): void { console.log("Hello"); }';
        }
        if (filePath.includes('service.ts')) {
          return 'export class UserService { public getUser(): User { return {}; } }';
        }
        if (filePath.includes('helpers.ts')) {
          return 'export const formatDate = (date: Date): string => date.toString();';
        }
        throw new Error(`File not found: ${filePath}`);
      });
    });

    it('should build symbol index from directory', async () => {
      const index = await validator.buildIndex('/test/project/src');

      expect(index.byName.size).toBeGreaterThan(0);
      expect(index.byFile.size).toBeGreaterThan(0);
      expect(index.stats.totalFiles).toBeGreaterThan(0);
      expect(index.stats.totalSymbols).toBeGreaterThan(0);

      // Check for expected symbols
      expect(index.byName.has('main')).toBe(true);
      expect(index.byName.has('UserService')).toBe(true);
      expect(index.byName.has('formatDate')).toBe(true);
    });

    it('should respect file extension filters', async () => {
      await validator.buildIndex('/test/project/src', {
        extensions: ['.ts', '.tsx'],
        exclude: ['node_modules/**'],
      });

      // Should call readFile for TypeScript files
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.ts$/),
        'utf8'
      );
    });

    it('should handle file reading errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const index = await validator.buildIndex('/test/project/src');

      // Should not throw, but return empty index
      expect(index.stats.totalFiles).toBe(0);
      expect(index.stats.totalSymbols).toBe(0);
    });

    it('should calculate statistics correctly', async () => {
      const index = await validator.buildIndex('/test/project/src');

      expect(index.stats.totalFiles).toBeGreaterThan(0);
      expect(index.stats.totalSymbols).toBeGreaterThan(0);
      expect(index.stats.byType).toBeDefined();
      expect(typeof index.stats.byType.function).toBe('number');
      expect(typeof index.stats.byType.class).toBe('number');
    });
  });

  // ============================================================================
  // Cross-Reference Validation Tests
  // ============================================================================

  describe('cross-reference validation', () => {
    let mockIndex: SymbolIndex;
    let mockReferences: DocumentationReference[];

    beforeEach(() => {
      // Create a mock symbol index
      mockIndex = {
        byName: new Map([
          ['UserService', [
            {
              name: 'UserService',
              type: 'class',
              file: '/src/user-service.ts',
              line: 10,
              column: 1,
              isExported: true,
            }
          ]],
          ['calculateTotal', [
            {
              name: 'calculateTotal',
              type: 'function',
              file: '/src/utils.ts',
              line: 5,
              column: 1,
              isExported: true,
            }
          ]],
          ['Config', [
            {
              name: 'Config',
              type: 'interface',
              file: '/src/types.ts',
              line: 15,
              column: 1,
              isExported: true,
            }
          ]],
        ]),
        byFile: new Map(),
        stats: {
          totalSymbols: 3,
          totalFiles: 3,
          byType: { class: 1, function: 1, interface: 1 },
        },
      };

      // Create mock references
      mockReferences = [
        {
          symbolName: 'UserService',
          referenceType: 'inline-code',
          sourceFile: '/docs/api.md',
          line: 10,
          column: 5,
          context: 'Use the `UserService` class',
        },
        {
          symbolName: 'calculateTotal',
          referenceType: 'code-block',
          sourceFile: '/docs/examples.md',
          line: 20,
          column: 15,
          context: 'const total = calculateTotal(items);',
        },
        {
          symbolName: 'NonExistentFunction',
          referenceType: 'see-tag',
          sourceFile: '/docs/advanced.md',
          line: 5,
          column: 20,
          context: '@see NonExistentFunction for details',
        },
        {
          symbolName: 'AnotherMissingClass',
          referenceType: 'inline-code',
          sourceFile: '/docs/guide.md',
          line: 30,
          column: 10,
          context: 'The `AnotherMissingClass` provides',
        },
      ];
    });

    it('should validate valid references correctly', () => {
      const validRef = mockReferences[0]; // UserService
      const isValid = validator.validateReference(mockIndex, validRef.symbolName);
      expect(isValid).toBe(true);
    });

    it('should detect invalid references correctly', () => {
      const invalidRef = mockReferences[2]; // NonExistentFunction
      const isValid = validator.validateReference(mockIndex, invalidRef.symbolName);
      expect(isValid).toBe(false);
    });

    it('should generate broken link reports', () => {
      const brokenLinks = validator.validateDocumentationReferences(mockIndex, mockReferences);

      expect(brokenLinks).toHaveLength(2);

      const nonExistentFunctionIssue = brokenLinks.find(
        issue => issue.description.includes('NonExistentFunction')
      );
      expect(nonExistentFunctionIssue).toBeDefined();
      expect(nonExistentFunctionIssue?.type).toBe('broken-link');
      expect(nonExistentFunctionIssue?.file).toBe('/docs/advanced.md');
      expect(nonExistentFunctionIssue?.line).toBe(5);
      expect(nonExistentFunctionIssue?.severity).toBe('high'); // @see tags have high severity

      const missingClassIssue = brokenLinks.find(
        issue => issue.description.includes('AnotherMissingClass')
      );
      expect(missingClassIssue).toBeDefined();
      expect(missingClassIssue?.type).toBe('broken-link');
      expect(missingClassIssue?.severity).toBe('medium'); // inline-code has medium severity
    });

    it('should provide suggestions for similar symbols', () => {
      // Add a similar symbol to the index
      mockIndex.byName.set('UserManager', [
        {
          name: 'UserManager',
          type: 'class',
          file: '/src/user-manager.ts',
          line: 5,
          column: 1,
          isExported: true,
        }
      ]);

      const brokenRef: DocumentationReference = {
        symbolName: 'UserManagar', // Typo in 'UserManager'
        referenceType: 'inline-code',
        sourceFile: '/docs/typo.md',
        line: 15,
        column: 10,
        context: 'Use the `UserManagar` class',
      };

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, [brokenRef]);

      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].suggestion).toContain('UserManager');
    });

    it('should assign correct severity levels', () => {
      const testReferences: DocumentationReference[] = [
        {
          symbolName: 'MissingSeeTag',
          referenceType: 'see-tag',
          sourceFile: '/test.md',
          line: 1,
          column: 1,
          context: '@see MissingSeeTag',
        },
        {
          symbolName: 'MissingInlineCode',
          referenceType: 'inline-code',
          sourceFile: '/test.md',
          line: 2,
          column: 1,
          context: '`MissingInlineCode`',
        },
        {
          symbolName: 'MissingCodeBlock',
          referenceType: 'code-block',
          sourceFile: '/test.md',
          line: 3,
          column: 1,
          context: 'MissingCodeBlock()',
        },
      ];

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, testReferences);

      expect(brokenLinks).toHaveLength(3);

      const seeTagIssue = brokenLinks.find(issue => issue.description.includes('MissingSeeTag'));
      expect(seeTagIssue?.severity).toBe('high');

      const inlineCodeIssue = brokenLinks.find(issue => issue.description.includes('MissingInlineCode'));
      expect(inlineCodeIssue?.severity).toBe('medium');

      const codeBlockIssue = brokenLinks.find(issue => issue.description.includes('MissingCodeBlock'));
      expect(codeBlockIssue?.severity).toBe('low');
    });

    it('should include context information in broken link reports', () => {
      const brokenLinks = validator.validateDocumentationReferences(mockIndex, mockReferences);

      brokenLinks.forEach(issue => {
        expect(issue.description).toBeTruthy();
        expect(issue.description).toContain('Context:');
        expect(issue.file).toBeTruthy();
        expect(typeof issue.line).toBe('number');
      });
    });
  });

  // ============================================================================
  // Similarity Algorithm Tests
  // ============================================================================

  describe('similarity algorithm', () => {
    it('should find similar symbol names', () => {
      const mockIndex: SymbolIndex = {
        byName: new Map([
          ['UserService', []],
          ['UserManager', []],
          ['UserRepository', []],
          ['FileService', []],
          ['DatabaseManager', []],
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 5, totalFiles: 1, byType: {} },
      };

      // Test similar names
      const similar = validator['findSimilarSymbols'](mockIndex, 'UserServic', 0.6);
      expect(similar).toContain('UserService');

      // Test with typo
      const typoSimilar = validator['findSimilarSymbols'](mockIndex, 'UserManger', 0.6);
      expect(typoSimilar).toContain('UserManager');

      // Test with completely different name
      const different = validator['findSimilarSymbols'](mockIndex, 'CompletelyDifferent', 0.6);
      expect(different).toHaveLength(0);
    });

    it('should calculate similarity scores correctly', () => {
      // Identical strings
      expect(validator['calculateSimilarity']('test', 'test')).toBe(1);

      // Completely different strings
      expect(validator['calculateSimilarity']('abc', 'xyz')).toBeLessThan(0.5);

      // Similar strings
      expect(validator['calculateSimilarity']('UserService', 'UserServic')).toBeGreaterThan(0.8);

      // Empty strings
      expect(validator['calculateSimilarity']('', '')).toBe(0);
      expect(validator['calculateSimilarity']('test', '')).toBe(0);
    });
  });

  // ============================================================================
  // Index Management Tests
  // ============================================================================

  describe('index management', () => {
    let testIndex: SymbolIndex;

    beforeEach(() => {
      testIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} },
      };
    });

    it('should lookup symbols by name correctly', () => {
      const symbol: SymbolInfo = {
        name: 'TestSymbol',
        type: 'function',
        file: '/test.ts',
        line: 10,
        column: 1,
        isExported: true,
      };

      testIndex.byName.set('TestSymbol', [symbol]);

      const results = validator.lookupSymbol(testIndex, 'TestSymbol');
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(symbol);

      const noResults = validator.lookupSymbol(testIndex, 'NonExistent');
      expect(noResults).toHaveLength(0);
    });

    it('should get symbols by file correctly', () => {
      const symbol: SymbolInfo = {
        name: 'TestSymbol',
        type: 'function',
        file: '/test.ts',
        line: 10,
        column: 1,
        isExported: true,
      };

      testIndex.byFile.set('/test.ts', [symbol]);

      const results = validator.getFileSymbols(testIndex, '/test.ts');
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(symbol);

      const noResults = validator.getFileSymbols(testIndex, '/nonexistent.ts');
      expect(noResults).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle malformed TypeScript gracefully', () => {
      const malformedContent = `
export function incomplete(
class MissingBrace {
  method() {
    // Missing closing brace
`;

      // Should not throw
      expect(() => {
        const symbols = validator.extractSymbols('/test/malformed.ts', malformedContent);
        expect(Array.isArray(symbols)).toBe(true);
      }).not.toThrow();
    });

    it('should handle empty content gracefully', () => {
      const emptyContent = '';
      const symbols = validator.extractSymbols('/test/empty.ts', emptyContent);
      expect(symbols).toHaveLength(0);
    });

    it('should handle files with only comments', () => {
      const commentOnlyContent = `
// This file only contains comments
/* Block comment */
/**
 * JSDoc comment
 */
`;

      const symbols = validator.extractSymbols('/test/comments.ts', commentOnlyContent);
      expect(symbols).toHaveLength(0);
    });

    it('should handle directory reading errors in buildIndex', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const index = await validator.buildIndex('/inaccessible/path');

      expect(index.stats.totalFiles).toBe(0);
      expect(index.stats.totalSymbols).toBe(0);
      expect(index.byName.size).toBe(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration tests', () => {
    it('should handle complete workflow from index building to validation', async () => {
      // Mock a complete project structure
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if (dirPath.includes('/src')) {
          return [
            { name: 'index.ts', isFile: () => true, isDirectory: () => false },
            { name: 'service.ts', isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        return [];
      });

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('index.ts')) {
          return `
export function main(): void {
  console.log('Hello, World!');
}

export class App {
  public start(): void {
    main();
  }
}
`;
        }
        if (filePath.includes('service.ts')) {
          return `
export class UserService {
  public getUser(id: string): Promise<User> {
    return fetch(\`/api/users/\${id}\`);
  }
}

export interface User {
  id: string;
  name: string;
}
`;
        }
        throw new Error('File not found');
      });

      // Build index
      const index = await validator.buildIndex('/project/src');
      expect(index.stats.totalSymbols).toBeGreaterThan(0);

      // Create documentation with references
      const docContent = `
# Project Documentation

Use the \`App\` class to start the application.
Call \`main()\` function for initialization.
The \`UserService\` handles user operations.

See \`NonExistentClass\` for advanced features.

\`\`\`typescript
const app = new App();
app.start();

const service = new UserService();
const user = await service.getUser('123');
\`\`\`
`;

      // Extract references
      const references = validator.extractDocumentationReferences('/docs/README.md', docContent);
      expect(references.length).toBeGreaterThan(0);

      // Validate references
      const brokenLinks = validator.validateDocumentationReferences(index, references);

      // Should find broken links (NonExistentClass)
      const nonExistentRef = brokenLinks.find(issue =>
        issue.description.includes('NonExistentClass')
      );
      expect(nonExistentRef).toBeDefined();
      expect(nonExistentRef?.type).toBe('broken-link');

      // Valid references should not appear in broken links
      const validAppRef = brokenLinks.find(issue =>
        issue.description.includes('App') && !issue.description.includes('NonExistent')
      );
      expect(validAppRef).toBeUndefined();
    });

    it('should handle mixed file types and complex project structure', async () => {
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if (dirPath.includes('/src')) {
          return [
            { name: 'components', isFile: () => false, isDirectory: () => true },
            { name: 'utils', isFile: () => false, isDirectory: () => true },
            { name: 'index.ts', isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        if (dirPath.includes('/components')) {
          return [
            { name: 'Button.tsx', isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        if (dirPath.includes('/utils')) {
          return [
            { name: 'helpers.js', isFile: () => true, isDirectory: () => false },
          ] as any;
        }
        return [];
      });

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('index.ts')) {
          return 'export * from "./components/Button"; export { formatDate } from "./utils/helpers";';
        }
        if (filePath.includes('Button.tsx')) {
          return 'export const Button = ({ children }: { children: string }) => <button>{children}</button>;';
        }
        if (filePath.includes('helpers.js')) {
          return 'export function formatDate(date) { return date.toISOString(); }';
        }
        throw new Error('File not found');
      });

      const index = await validator.buildIndex('/project/src', {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      });

      expect(index.stats.totalFiles).toBe(3);
      expect(index.byName.has('Button')).toBe(true);
      expect(index.byName.has('formatDate')).toBe(true);
    });
  });
});