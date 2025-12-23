/**
 * Cross Reference Validator - Acceptance Criteria Unit Tests
 *
 * This test suite specifically validates the acceptance criteria:
 * - Valid references pass validation
 * - Missing function references are detected
 * - Missing type references are detected
 * - All tests pass
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossReferenceValidator, type SymbolIndex, type DocumentationReference } from './cross-reference-validator';
import { type OutdatedDocumentation } from '@apexcli/core';

describe('CrossReferenceValidator - Acceptance Criteria', () => {
  let validator: CrossReferenceValidator;
  let symbolIndex: SymbolIndex;

  beforeEach(() => {
    validator = new CrossReferenceValidator();

    // Create a sample symbol index with known symbols
    symbolIndex = {
      byName: new Map([
        // Functions
        ['calculateTotal', [{
          name: 'calculateTotal',
          type: 'function',
          file: '/src/utils.ts',
          line: 10,
          column: 1,
          isExported: true
        }]],
        ['processData', [{
          name: 'processData',
          type: 'function',
          file: '/src/data.ts',
          line: 15,
          column: 1,
          isExported: true
        }]],
        // Classes
        ['UserService', [{
          name: 'UserService',
          type: 'class',
          file: '/src/services.ts',
          line: 20,
          column: 1,
          isExported: true
        }]],
        ['DataManager', [{
          name: 'DataManager',
          type: 'class',
          file: '/src/managers.ts',
          line: 5,
          column: 1,
          isExported: true
        }]],
        // Types and Interfaces
        ['User', [{
          name: 'User',
          type: 'interface',
          file: '/src/types.ts',
          line: 8,
          column: 1,
          isExported: true
        }]],
        ['ConfigOptions', [{
          name: 'ConfigOptions',
          type: 'type',
          file: '/src/config.ts',
          line: 3,
          column: 1,
          isExported: true
        }]],
        ['Status', [{
          name: 'Status',
          type: 'enum',
          file: '/src/enums.ts',
          line: 12,
          column: 1,
          isExported: true
        }]]
      ]),
      byFile: new Map(),
      stats: {
        totalSymbols: 7,
        totalFiles: 6,
        byType: {
          function: 2,
          class: 2,
          interface: 1,
          type: 1,
          enum: 1
        }
      }
    };
  });

  describe('AC1: Valid references pass validation', () => {
    it('should validate existing function references', () => {
      const isValidFunction = validator.validateReference(symbolIndex, 'calculateTotal');
      expect(isValidFunction).toBe(true);

      const isValidFunction2 = validator.validateReference(symbolIndex, 'processData');
      expect(isValidFunction2).toBe(true);
    });

    it('should validate existing class references', () => {
      const isValidClass = validator.validateReference(symbolIndex, 'UserService');
      expect(isValidClass).toBe(true);

      const isValidClass2 = validator.validateReference(symbolIndex, 'DataManager');
      expect(isValidClass2).toBe(true);
    });

    it('should validate existing type references', () => {
      const isValidInterface = validator.validateReference(symbolIndex, 'User');
      expect(isValidInterface).toBe(true);

      const isValidType = validator.validateReference(symbolIndex, 'ConfigOptions');
      expect(isValidType).toBe(true);

      const isValidEnum = validator.validateReference(symbolIndex, 'Status');
      expect(isValidEnum).toBe(true);
    });

    it('should not report valid references as broken links', () => {
      const validReferences: DocumentationReference[] = [
        {
          symbolName: 'calculateTotal',
          referenceType: 'inline-code',
          sourceFile: '/docs/api.md',
          line: 10,
          column: 5,
          context: 'Use `calculateTotal()` function'
        },
        {
          symbolName: 'UserService',
          referenceType: 'code-block',
          sourceFile: '/docs/examples.md',
          line: 20,
          column: 10,
          context: 'const service = new UserService();'
        },
        {
          symbolName: 'User',
          referenceType: 'see-tag',
          sourceFile: '/docs/types.md',
          line: 15,
          column: 8,
          context: '@see User interface for data structure'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(symbolIndex, validReferences);
      expect(brokenLinks).toHaveLength(0);
    });
  });

  describe('AC2: Missing function references are detected', () => {
    it('should detect non-existent function references', () => {
      const isValidMissingFunction = validator.validateReference(symbolIndex, 'nonExistentFunction');
      expect(isValidMissingFunction).toBe(false);
    });

    it('should report missing function references as broken links', () => {
      const missingFunctionRefs: DocumentationReference[] = [
        {
          symbolName: 'missingCalculate',
          referenceType: 'inline-code',
          sourceFile: '/docs/missing.md',
          line: 5,
          column: 10,
          context: 'Use `missingCalculate()` to compute values'
        },
        {
          symbolName: 'undefinedProcessor',
          referenceType: 'code-block',
          sourceFile: '/docs/code.md',
          line: 25,
          column: 15,
          context: 'const result = undefinedProcessor(data);'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(symbolIndex, missingFunctionRefs);

      expect(brokenLinks).toHaveLength(2);

      const missingCalculateIssue = brokenLinks.find(issue =>
        issue.description.includes('missingCalculate')
      );
      expect(missingCalculateIssue).toBeDefined();
      expect(missingCalculateIssue?.type).toBe('broken-link');
      expect(missingCalculateIssue?.file).toBe('/docs/missing.md');
      expect(missingCalculateIssue?.line).toBe(5);
      expect(missingCalculateIssue?.severity).toBe('medium');

      const undefinedProcessorIssue = brokenLinks.find(issue =>
        issue.description.includes('undefinedProcessor')
      );
      expect(undefinedProcessorIssue).toBeDefined();
      expect(undefinedProcessorIssue?.type).toBe('broken-link');
      expect(undefinedProcessorIssue?.severity).toBe('low'); // code-block has low severity
    });

    it('should detect missing function references with @see tags', () => {
      const seeTagMissingFunction: DocumentationReference[] = [
        {
          symbolName: 'nonExistentValidate',
          referenceType: 'see-tag',
          sourceFile: '/docs/validation.md',
          line: 8,
          column: 12,
          context: '@see nonExistentValidate for validation logic'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(symbolIndex, seeTagMissingFunction);

      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].description).toContain('nonExistentValidate');
      expect(brokenLinks[0].severity).toBe('high'); // @see tags have high severity
    });
  });

  describe('AC3: Missing type references are detected', () => {
    it('should detect non-existent interface references', () => {
      const isValidMissingInterface = validator.validateReference(symbolIndex, 'MissingInterface');
      expect(isValidMissingInterface).toBe(false);
    });

    it('should detect non-existent type references', () => {
      const isValidMissingType = validator.validateReference(symbolIndex, 'UndefinedType');
      expect(isValidMissingType).toBe(false);
    });

    it('should detect non-existent class references', () => {
      const isValidMissingClass = validator.validateReference(symbolIndex, 'NonExistentClass');
      expect(isValidMissingClass).toBe(false);
    });

    it('should report missing type references as broken links', () => {
      const missingTypeRefs: DocumentationReference[] = [
        {
          symbolName: 'MissingUserType',
          referenceType: 'inline-code',
          sourceFile: '/docs/types.md',
          line: 12,
          column: 8,
          context: 'Define using `MissingUserType` interface'
        },
        {
          symbolName: 'UndefinedConfig',
          referenceType: 'code-block',
          sourceFile: '/docs/config.md',
          line: 30,
          column: 20,
          context: 'const config: UndefinedConfig = { ... };'
        },
        {
          symbolName: 'NonExistentEnum',
          referenceType: 'see-tag',
          sourceFile: '/docs/enums.md',
          line: 6,
          column: 5,
          context: '@see NonExistentEnum for status values'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(symbolIndex, missingTypeRefs);

      expect(brokenLinks).toHaveLength(3);

      const missingUserTypeIssue = brokenLinks.find(issue =>
        issue.description.includes('MissingUserType')
      );
      expect(missingUserTypeIssue).toBeDefined();
      expect(missingUserTypeIssue?.type).toBe('broken-link');

      const undefinedConfigIssue = brokenLinks.find(issue =>
        issue.description.includes('UndefinedConfig')
      );
      expect(undefinedConfigIssue).toBeDefined();
      expect(undefinedConfigIssue?.type).toBe('broken-link');

      const nonExistentEnumIssue = brokenLinks.find(issue =>
        issue.description.includes('NonExistentEnum')
      );
      expect(nonExistentEnumIssue).toBeDefined();
      expect(nonExistentEnumIssue?.type).toBe('broken-link');
      expect(nonExistentEnumIssue?.severity).toBe('high'); // @see tag
    });
  });

  describe('AC4: All tests pass - Integration validation', () => {
    it('should handle mixed valid and invalid references correctly', () => {
      const mixedReferences: DocumentationReference[] = [
        // Valid references
        {
          symbolName: 'calculateTotal',
          referenceType: 'inline-code',
          sourceFile: '/docs/mixed.md',
          line: 5,
          column: 10,
          context: 'Use `calculateTotal()` to sum values'
        },
        {
          symbolName: 'UserService',
          referenceType: 'code-block',
          sourceFile: '/docs/mixed.md',
          line: 15,
          column: 20,
          context: 'const service = new UserService();'
        },
        {
          symbolName: 'User',
          referenceType: 'see-tag',
          sourceFile: '/docs/mixed.md',
          line: 25,
          column: 8,
          context: '@see User for user data structure'
        },

        // Invalid references
        {
          symbolName: 'invalidFunction',
          referenceType: 'inline-code',
          sourceFile: '/docs/mixed.md',
          line: 35,
          column: 12,
          context: 'Call `invalidFunction()` for processing'
        },
        {
          symbolName: 'MissingClass',
          referenceType: 'code-block',
          sourceFile: '/docs/mixed.md',
          line: 45,
          column: 25,
          context: 'const instance = new MissingClass();'
        },
        {
          symbolName: 'UndefinedType',
          referenceType: 'see-tag',
          sourceFile: '/docs/mixed.md',
          line: 55,
          column: 6,
          context: '@see UndefinedType for type definition'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(symbolIndex, mixedReferences);

      // Should find exactly 3 broken references (the invalid ones)
      expect(brokenLinks).toHaveLength(3);

      // Verify the broken references are the correct ones
      const brokenSymbols = brokenLinks.map(issue => {
        const match = issue.description.match(/'([^']+)'/);
        return match ? match[1] : null;
      });

      expect(brokenSymbols).toContain('invalidFunction');
      expect(brokenSymbols).toContain('MissingClass');
      expect(brokenSymbols).toContain('UndefinedType');

      // Verify valid references are not reported as broken
      expect(brokenSymbols).not.toContain('calculateTotal');
      expect(brokenSymbols).not.toContain('UserService');
      expect(brokenSymbols).not.toContain('User');

      // Verify all broken link issues have required properties
      brokenLinks.forEach(issue => {
        expect(issue.type).toBe('broken-link');
        expect(issue.file).toBe('/docs/mixed.md');
        expect(typeof issue.line).toBe('number');
        expect(issue.line).toBeGreaterThan(0);
        expect(issue.description).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(issue.severity);
        expect(issue.suggestion).toBeTruthy();
      });
    });

    it('should provide meaningful error messages and suggestions', () => {
      const typoReference: DocumentationReference[] = [
        {
          symbolName: 'calcualteTotal', // Typo in 'calculateTotal'
          referenceType: 'inline-code',
          sourceFile: '/docs/typo.md',
          line: 10,
          column: 5,
          context: 'Use `calcualteTotal()` function'
        }
      ];

      const brokenLinks = validator.validateDocumentationReferences(symbolIndex, typoReference);

      expect(brokenLinks).toHaveLength(1);

      const issue = brokenLinks[0];
      expect(issue.description).toContain('calcualteTotal');
      expect(issue.description).toContain('Reference to non-existent symbol');
      expect(issue.description).toContain('Context:');
      expect(issue.suggestion).toContain('calculateTotal'); // Should suggest the correct spelling
    });
  });
});