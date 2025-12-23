/**
 * CrossReferenceValidator Coverage Tests
 *
 * Comprehensive tests to ensure all aspects of CrossReferenceValidator
 * functionality work correctly when imported from the analyzers index.
 * These tests focus on coverage of the export paths and integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OutdatedDocumentation } from '@apexcli/core';

// Mock fs module
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe('CrossReferenceValidator Coverage Tests', () => {
  let CrossReferenceValidator: any;
  let validator: any;

  beforeEach(async () => {
    // Import from the analyzers index to test the export path
    const analyzerExports = await import('../index');
    CrossReferenceValidator = analyzerExports.CrossReferenceValidator;
    validator = new CrossReferenceValidator();
    vi.clearAllMocks();
  });

  describe('symbol extraction coverage', () => {
    it('should extract all supported symbol types', () => {
      const complexContent = `
// Various function declarations
export function regularFunction(): void {}
export async function asyncFunction(): Promise<void> {}
function privateFunction(): void {}

// Arrow functions
export const arrowFunction = (): void => {};
const privateArrowFunction = (): void => {};
export const asyncArrowFunction = async (): Promise<void> => {};

// Classes
export class PublicClass {
  public publicProperty: string = 'test';
  private privateProperty: number = 42;
  protected protectedProperty: boolean = true;
  static staticProperty: string = 'static';

  constructor(param: string) {}

  public publicMethod(): void {}
  private privateMethod(): void {}
  protected protectedMethod(): void {}
  static staticMethod(): void {}
  async asyncMethod(): Promise<void> {}
}

class PrivateClass {
  method(): void {}
}

// Interfaces and types
export interface PublicInterface {
  prop: string;
}

interface PrivateInterface {
  prop: number;
}

export type PublicType = 'a' | 'b' | 'c';
type PrivateType = { value: string };

// Enums
export enum PublicEnum {
  VALUE1 = 'value1',
  VALUE2 = 'value2'
}

enum PrivateEnum {
  INTERNAL = 'internal'
}

// Constants and variables
export const PUBLIC_CONSTANT = 'constant';
const PRIVATE_CONSTANT = 'private';
export let publicVariable = 'variable';
let privateVariable = 'private';
var legacyVariable = 'legacy';
`;

      const symbols = validator.extractSymbols('/test/complex.ts', complexContent, true, true);

      // Count different symbol types
      const functionSymbols = symbols.filter((s: any) => s.type === 'function');
      const classSymbols = symbols.filter((s: any) => s.type === 'class');
      const methodSymbols = symbols.filter((s: any) => s.type === 'method');
      const propertySymbols = symbols.filter((s: any) => s.type === 'property');
      const interfaceSymbols = symbols.filter((s: any) => s.type === 'interface');
      const typeSymbols = symbols.filter((s: any) => s.type === 'type');
      const enumSymbols = symbols.filter((s: any) => s.type === 'enum');
      const constantSymbols = symbols.filter((s: any) => s.type === 'const');
      const variableSymbols = symbols.filter((s: any) => s.type === 'variable');

      // Verify we extracted the expected counts
      expect(functionSymbols.length).toBeGreaterThanOrEqual(3); // regularFunction, asyncFunction, privateFunction, arrows
      expect(classSymbols.length).toBe(2); // PublicClass, PrivateClass
      expect(methodSymbols.length).toBeGreaterThan(0);
      expect(propertySymbols.length).toBeGreaterThan(0);
      expect(interfaceSymbols.length).toBe(2);
      expect(typeSymbols.length).toBe(2);
      expect(enumSymbols.length).toBe(2);
      expect(constantSymbols.length).toBeGreaterThan(0);
      expect(variableSymbols.length).toBeGreaterThan(0);

      // Verify exported vs non-exported
      const exportedSymbols = symbols.filter((s: any) => s.isExported);
      const nonExportedSymbols = symbols.filter((s: any) => !s.isExported);

      expect(exportedSymbols.length).toBeGreaterThan(0);
      expect(nonExportedSymbols.length).toBeGreaterThan(0);

      // Verify parent relationships for class members
      const classMembers = symbols.filter((s: any) => s.parent);
      expect(classMembers.length).toBeGreaterThan(0);

      const publicClassMembers = classMembers.filter((s: any) => s.parent === 'PublicClass');
      expect(publicClassMembers.length).toBeGreaterThan(0);
    });

    it('should handle JSDoc documentation correctly', () => {
      const documentedContent = `
/**
 * Main application class
 * Handles core functionality
 * @since v1.0.0
 */
export class Application {
  /**
   * Initializes the application
   * @param config Configuration object
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(config: Config): Promise<void> {
    // Implementation
  }
}

/**
 * Utility function for data processing
 * @param data Input data to process
 * @returns Processed data
 */
export function processData(data: any[]): any[] {
  return data.map(item => item);
}
`;

      const symbols = validator.extractSymbols('/test/documented.ts', documentedContent);

      const appClass = symbols.find((s: any) => s.name === 'Application');
      expect(appClass?.documentation).toBeDefined();
      expect(appClass?.documentation).toContain('Main application class');

      const processDataFunc = symbols.find((s: any) => s.name === 'processData');
      expect(processDataFunc?.documentation).toBeDefined();
      expect(processDataFunc?.documentation).toContain('Utility function');

      // Check method documentation
      const initializeMethod = symbols.find((s: any) => s.name === 'initialize');
      expect(initializeMethod?.documentation).toBeDefined();
      expect(initializeMethod?.documentation).toContain('Initializes the application');
    });
  });

  describe('documentation reference extraction coverage', () => {
    it('should extract all reference types comprehensively', () => {
      const comprehensiveDoc = `
# Comprehensive Documentation

## Inline Code References
Use \`MainFunction()\` to start the application.
The \`ConfigInterface\` defines configuration options.
Call \`DataProcessor.process()\` for data handling.
Check \`ErrorHandler\` for error management.

## Code Block Examples

### TypeScript Example
\`\`\`typescript
import { MainFunction, ConfigInterface } from './lib';

const config: ConfigInterface = { debug: true };
await MainFunction(config);

const processor = new DataProcessor();
const result = processor.process(data);
\`\`\`

### JavaScript Example
\`\`\`javascript
const app = new Application();
app.initialize();

const handler = new ErrorHandler();
handler.setup();
\`\`\`

### Plain Code
\`\`\`
SimpleFunction();
BasicClass.method();
\`\`\`

## JSDoc References

/**
 * Authentication service
 * @see UserManager for user operations
 * @see {TokenValidator.validate} for token validation
 * @see AuthConfig.timeout for timeout settings
 * @see {Logger} for logging functionality
 */
export class AuthService {
  /**
   * Login method
   * @see CredentialValidator.check
   * @see {SessionManager.create}
   * @see LoginConfig for options
   */
  login(creds: Credentials) {}
}

## More References
Use \`UtilityClass\` for utilities.
The \`TypeDefinition\` provides type safety.
`;

      const references = validator.extractDocumentationReferences('/docs/comprehensive.md', comprehensiveDoc);

      // Verify we extracted references
      expect(references.length).toBeGreaterThan(0);

      // Check inline code references
      const inlineRefs = references.filter((r: any) => r.referenceType === 'inline-code');
      expect(inlineRefs.length).toBeGreaterThan(0);

      const mainFuncRef = inlineRefs.find((r: any) => r.symbolName === 'MainFunction');
      expect(mainFuncRef).toBeDefined();

      const configInterfaceRef = inlineRefs.find((r: any) => r.symbolName === 'ConfigInterface');
      expect(configInterfaceRef).toBeDefined();

      // Check code block references
      const codeBlockRefs = references.filter((r: any) => r.referenceType === 'code-block');
      expect(codeBlockRefs.length).toBeGreaterThan(0);

      const appRef = codeBlockRefs.find((r: any) => r.symbolName === 'Application');
      expect(appRef).toBeDefined();

      const errorHandlerRef = codeBlockRefs.find((r: any) => r.symbolName === 'ErrorHandler');
      expect(errorHandlerRef).toBeDefined();

      // Check @see tag references
      const seeTagRefs = references.filter((r: any) => r.referenceType === 'see-tag');
      expect(seeTagRefs.length).toBeGreaterThan(0);

      const userManagerRef = seeTagRefs.find((r: any) => r.symbolName === 'UserManager');
      expect(userManagerRef).toBeDefined();

      const tokenValidatorRef = seeTagRefs.find((r: any) => r.symbolName === 'validate');
      expect(tokenValidatorRef).toBeDefined();

      // Check dotted references are properly handled
      const timeoutRef = seeTagRefs.find((r: any) => r.symbolName === 'timeout');
      expect(timeoutRef).toBeDefined();
    });

    it('should filter built-ins and keywords correctly', () => {
      const codeWithBuiltins = `
\`\`\`javascript
console.log('Hello');
setTimeout(() => {}, 1000);
const data = JSON.parse(response);
Promise.resolve(value);
Array.from(iterable);
Object.keys(obj);
Math.random();
Date.now();

// Keywords and control structures
if (condition) {
  for (let i = 0; i < length; i++) {
    function innerFunc() {}
    const result = return value;
  }
}
\`\`\`
`;

      const references = validator.extractCodeBlockReferences('/docs/builtins.md', codeWithBuiltins);

      // Verify built-in functions are filtered out
      const builtinNames = ['console', 'setTimeout', 'JSON', 'Promise', 'Array', 'Object', 'Math', 'Date'];
      const keywords = ['if', 'for', 'let', 'const', 'function', 'return'];

      const foundBuiltins = references.filter((r: any) =>
        builtinNames.includes(r.symbolName) || keywords.includes(r.symbolName)
      );

      expect(foundBuiltins.length).toBe(0);

      // But valid user symbols should be included
      const innerFuncRef = references.find((r: any) => r.symbolName === 'innerFunc');
      if (innerFuncRef) {
        // If found, it should be a valid reference
        expect(innerFuncRef.referenceType).toBe('code-block');
      }
    });
  });

  describe('validation and cross-reference coverage', () => {
    it('should perform comprehensive validation with suggestions', () => {
      // Create a comprehensive symbol index
      const comprehensiveIndex = {
        byName: new Map([
          ['UserService', [{
            name: 'UserService',
            type: 'class',
            file: '/src/user-service.ts',
            line: 10,
            column: 1,
            isExported: true,
          }]],
          ['UserManager', [{
            name: 'UserManager',
            type: 'class',
            file: '/src/user-manager.ts',
            line: 5,
            column: 1,
            isExported: true,
          }]],
          ['AuthService', [{
            name: 'AuthService',
            type: 'class',
            file: '/src/auth.ts',
            line: 15,
            column: 1,
            isExported: true,
          }]],
          ['validateToken', [{
            name: 'validateToken',
            type: 'function',
            file: '/src/auth.ts',
            line: 50,
            column: 1,
            isExported: true,
          }]],
          ['ConfigInterface', [{
            name: 'ConfigInterface',
            type: 'interface',
            file: '/src/types.ts',
            line: 20,
            column: 1,
            isExported: true,
          }]]
        ]),
        byFile: new Map(),
        stats: {
          totalSymbols: 5,
          totalFiles: 3,
          byType: { class: 3, function: 1, interface: 1 }
        }
      };

      const mixedReferences = [
        // Valid references
        {
          symbolName: 'UserService',
          referenceType: 'inline-code' as const,
          sourceFile: '/docs/users.md',
          line: 10,
          column: 5,
          context: 'Use `UserService` for user operations',
        },
        {
          symbolName: 'validateToken',
          referenceType: 'see-tag' as const,
          sourceFile: '/docs/auth.md',
          line: 25,
          column: 10,
          context: '@see validateToken for validation',
        },

        // Invalid references with similar names (test similarity algorithm)
        {
          symbolName: 'UserServic', // Missing 'e'
          referenceType: 'inline-code' as const,
          sourceFile: '/docs/typo1.md',
          line: 15,
          column: 8,
          context: 'Call `UserServic` method',
        },
        {
          symbolName: 'UserManagar', // Typo in 'Manager'
          referenceType: 'code-block' as const,
          sourceFile: '/docs/typo2.md',
          line: 30,
          column: 15,
          context: 'new UserManagar()',
        },
        {
          symbolName: 'AuthServ', // Shortened name
          referenceType: 'see-tag' as const,
          sourceFile: '/docs/typo3.md',
          line: 5,
          column: 12,
          context: '@see AuthServ for authentication',
        },

        // Completely invalid references
        {
          symbolName: 'NonExistentClass',
          referenceType: 'inline-code' as const,
          sourceFile: '/docs/missing.md',
          line: 40,
          column: 20,
          context: 'Use `NonExistentClass` for advanced features',
        },
        {
          symbolName: 'CompletelyDifferent',
          referenceType: 'see-tag' as const,
          sourceFile: '/docs/invalid.md',
          line: 50,
          column: 5,
          context: '@see CompletelyDifferent for details',
        },
      ];

      const brokenLinks = validator.validateDocumentationReferences(comprehensiveIndex, mixedReferences);

      // Should find broken links for invalid references
      expect(brokenLinks.length).toBeGreaterThan(0);

      // Check typo corrections
      const userServicIssue = brokenLinks.find((issue: OutdatedDocumentation) =>
        issue.description.includes('UserServic')
      );
      expect(userServicIssue).toBeDefined();
      expect(userServicIssue?.suggestion).toContain('UserService');

      const userManagerIssue = brokenLinks.find((issue: OutdatedDocumentation) =>
        issue.description.includes('UserManagar')
      );
      expect(userManagerIssue).toBeDefined();
      expect(userManagerIssue?.suggestion).toContain('UserManager');

      const authServiceIssue = brokenLinks.find((issue: OutdatedDocumentation) =>
        issue.description.includes('AuthServ')
      );
      expect(authServiceIssue).toBeDefined();
      expect(authServiceIssue?.suggestion).toContain('AuthService');

      // Check completely different names don't get suggestions
      const completelyDifferentIssue = brokenLinks.find((issue: OutdatedDocumentation) =>
        issue.description.includes('CompletelyDifferent')
      );
      expect(completelyDifferentIssue).toBeDefined();
      expect(completelyDifferentIssue?.suggestion).toBe('Symbol not found in codebase');

      // Check severity levels are assigned correctly
      const seeTagIssues = brokenLinks.filter((issue: OutdatedDocumentation) =>
        issue.severity === 'high'
      );
      const inlineCodeIssues = brokenLinks.filter((issue: OutdatedDocumentation) =>
        issue.severity === 'medium'
      );
      const codeBlockIssues = brokenLinks.filter((issue: OutdatedDocumentation) =>
        issue.severity === 'low'
      );

      expect(seeTagIssues.length).toBeGreaterThan(0);
      expect(inlineCodeIssues.length).toBeGreaterThan(0);
      expect(codeBlockIssues.length).toBeGreaterThan(0);
    });

    it('should handle index operations correctly', () => {
      const testIndex = {
        byName: new Map([
          ['TestSymbol', [{
            name: 'TestSymbol',
            type: 'function',
            file: '/test.ts',
            line: 5,
            column: 1,
            isExported: true,
          }]],
          ['DuplicateSymbol', [
            {
              name: 'DuplicateSymbol',
              type: 'function',
              file: '/test1.ts',
              line: 10,
              column: 1,
              isExported: true,
            },
            {
              name: 'DuplicateSymbol',
              type: 'class',
              file: '/test2.ts',
              line: 15,
              column: 1,
              isExported: false,
            }
          ]]
        ]),
        byFile: new Map([
          ['/test.ts', [{
            name: 'TestSymbol',
            type: 'function',
            file: '/test.ts',
            line: 5,
            column: 1,
            isExported: true,
          }]],
          ['/test1.ts', [{
            name: 'DuplicateSymbol',
            type: 'function',
            file: '/test1.ts',
            line: 10,
            column: 1,
            isExported: true,
          }]]
        ]),
        stats: {
          totalSymbols: 3,
          totalFiles: 2,
          byType: { function: 2, class: 1 }
        }
      };

      // Test lookup operations
      const testSymbolResults = validator.lookupSymbol(testIndex, 'TestSymbol');
      expect(testSymbolResults).toHaveLength(1);
      expect(testSymbolResults[0].name).toBe('TestSymbol');

      const duplicateResults = validator.lookupSymbol(testIndex, 'DuplicateSymbol');
      expect(duplicateResults).toHaveLength(2);
      expect(duplicateResults[0].type).toBe('function');
      expect(duplicateResults[1].type).toBe('class');

      const nonExistentResults = validator.lookupSymbol(testIndex, 'NonExistent');
      expect(nonExistentResults).toHaveLength(0);

      // Test file operations
      const testFileSymbols = validator.getFileSymbols(testIndex, '/test.ts');
      expect(testFileSymbols).toHaveLength(1);
      expect(testFileSymbols[0].name).toBe('TestSymbol');

      const nonExistentFileSymbols = validator.getFileSymbols(testIndex, '/nonexistent.ts');
      expect(nonExistentFileSymbols).toHaveLength(0);

      // Test validation
      expect(validator.validateReference(testIndex, 'TestSymbol')).toBe(true);
      expect(validator.validateReference(testIndex, 'DuplicateSymbol')).toBe(true);
      expect(validator.validateReference(testIndex, 'NonExistent')).toBe(false);
    });
  });

  describe('error handling coverage', () => {
    it('should handle all types of malformed content gracefully', () => {
      const malformedCases = [
        '', // Empty
        '   \n\n  \t  ', // Whitespace only
        '// Just comments\n/* More comments */', // Comments only
        'export function incomplete(', // Incomplete syntax
        'class MissingBrace {\nmethod() {\n// Missing closing brace', // Unmatched braces
        'export {{}', // Invalid syntax
        'function func() { return }} extra', // Extra braces
        'export class export class', // Duplicate keywords
        'if (true) { function nested() {} }', // Nested in control structure
      ];

      malformedCases.forEach((content, index) => {
        expect(() => {
          const symbols = validator.extractSymbols(`/test/malformed${index}.ts`, content);
          expect(Array.isArray(symbols)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should handle extraction errors gracefully', () => {
      const emptyDocumentation = '';
      const references = validator.extractDocumentationReferences('/empty.md', emptyDocumentation);
      expect(Array.isArray(references)).toBe(true);
      expect(references).toHaveLength(0);

      const malformedMarkdown = '```\nunclosed code block\n';
      const malformedRefs = validator.extractDocumentationReferences('/malformed.md', malformedMarkdown);
      expect(Array.isArray(malformedRefs)).toBe(true);

      const invalidContext = {
        symbolName: '',
        referenceType: 'inline-code' as const,
        sourceFile: '',
        line: -1,
        column: -1,
        context: '',
      };

      const emptyIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      };

      // Should handle gracefully
      expect(() => {
        validator.validateDocumentationReferences(emptyIndex, [invalidContext]);
      }).not.toThrow();
    });
  });

  describe('similarity algorithm coverage', () => {
    it('should test similarity calculation edge cases', () => {
      // Test the private calculateSimilarity method through similar symbol finding
      const testIndex = {
        byName: new Map([
          ['ExactMatch', []],
          ['VeryCloseMatch', []],
          ['SomewhatsimilarMatch', []],
          ['CompletelyDifferent', []],
          ['a', []], // Single character
          ['', []], // Empty string (edge case)
          ['Test123', []], // With numbers
          ['test_with_underscores', []], // With underscores
          ['TestWithMixedCase', []], // Mixed case
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 8, totalFiles: 1, byType: {} }
      };

      // Test exact match
      const exactMatches = (validator as any).findSimilarSymbols(testIndex, 'ExactMatch', 0.9);
      expect(exactMatches).toContain('ExactMatch');

      // Test close match
      const closeMatches = (validator as any).findSimilarSymbols(testIndex, 'VeryCloseMach', 0.7);
      expect(closeMatches).toContain('VeryCloseMatch');

      // Test completely different
      const noMatches = (validator as any).findSimilarSymbols(testIndex, 'xyz', 0.5);
      expect(noMatches).toHaveLength(0);

      // Test threshold behavior
      const lowThreshold = (validator as any).findSimilarSymbols(testIndex, 'Test', 0.1);
      const highThreshold = (validator as any).findSimilarSymbols(testIndex, 'Test', 0.9);
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);

      // Test edge cases directly if possible
      const similarity1 = (validator as any).calculateSimilarity('', '');
      expect(similarity1).toBe(0);

      const similarity2 = (validator as any).calculateSimilarity('test', '');
      expect(similarity2).toBe(0);

      const similarity3 = (validator as any).calculateSimilarity('identical', 'identical');
      expect(similarity3).toBe(1);
    });
  });
});