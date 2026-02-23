/**
 * Unit tests for SemanticSearch
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticSearch, type SemanticSearchOptions } from '../semantic-search.js';
import type { RepositoryMap, CodeSymbol, CodeFile } from '@apexcli/core/types';

describe('SemanticSearch', () => {
  let mockRepositoryMap: RepositoryMap;
  let semanticSearch: SemanticSearch;

  beforeEach(() => {
    mockRepositoryMap = createMockRepositoryMap();
    semanticSearch = new SemanticSearch(mockRepositoryMap);
  });

  describe('search()', () => {
    it('should find symbols by exact name match', () => {
      const results = semanticSearch.search('validateEmail');

      expect(results.length).toBeGreaterThan(0);
      const emailValidator = results.find(r => r.symbol.name === 'validateEmail');
      expect(emailValidator).toBeDefined();
      expect(emailValidator!.score).toBeGreaterThan(0.8);
    });

    it('should find symbols by partial name match', () => {
      const results = semanticSearch.search('validate');

      expect(results.length).toBeGreaterThan(0);
      const validators = results.filter(r => r.symbol.name.includes('validate'));
      expect(validators.length).toBeGreaterThan(1);
    });

    it('should find symbols by natural language query', () => {
      const results = semanticSearch.search('function that checks email format');

      expect(results.length).toBeGreaterThan(0);
      const emailValidator = results.find(r =>
        r.symbol.name.includes('email') && r.symbol.type === 'function'
      );
      expect(emailValidator).toBeDefined();
    });

    it('should filter by symbol types', () => {
      const results = semanticSearch.search('User', {
        symbolTypes: ['class']
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.symbol.type).toBe('class');
      });
    });

    it('should limit results count', () => {
      const results = semanticSearch.search('test', {
        limit: 3
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should filter by minimum score', () => {
      const results = semanticSearch.search('xyz', {
        minScore: 0.8
      });

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should rank results by relevance', () => {
      const results = semanticSearch.search('user service');

      expect(results.length).toBeGreaterThan(1);

      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should include documentation in search when enabled', () => {
      const results = semanticSearch.search('email validation', {
        includeDocumentation: true
      });

      expect(results.length).toBeGreaterThan(0);
      const docMatch = results.find(r => r.matchType === 'documentation');
      expect(docMatch).toBeDefined();
    });

    it('should use different search strategies', () => {
      const keywordResults = semanticSearch.search('UserService', { strategy: 'keyword' });
      const fuzzyResults = semanticSearch.search('UserServic', { strategy: 'fuzzy' });
      const semanticResults = semanticSearch.search('user management', { strategy: 'semantic' });

      expect(keywordResults.length).toBeGreaterThan(0);
      expect(fuzzyResults.length).toBeGreaterThan(0);
      expect(semanticResults.length).toBeGreaterThan(0);
    });
  });

  describe('findSimilar()', () => {
    it('should find symbols similar to a given symbol', () => {
      const userServiceSymbol = mockRepositoryMap.files[0].symbols.find(s => s.name === 'UserService')!;
      const similar = semanticSearch.findSimilar(userServiceSymbol);

      expect(similar.length).toBeGreaterThan(0);

      // Should not include the original symbol
      const originalFound = similar.find(r =>
        r.symbol.name === userServiceSymbol.name &&
        r.symbol.filePath === userServiceSymbol.filePath
      );
      expect(originalFound).toBeUndefined();
    });

    it('should find similar functions with similar signatures', () => {
      const validateEmailSymbol = mockRepositoryMap.files[0].symbols.find(s => s.name === 'validateEmail')!;
      const similar = semanticSearch.findSimilar(validateEmailSymbol, {
        symbolTypes: ['function']
      });

      expect(similar.length).toBeGreaterThan(0);
      similar.forEach(result => {
        expect(result.symbol.type).toBe('function');
      });
    });
  });

  describe('searchByExample()', () => {
    it('should find symbols matching code patterns', () => {
      const results = semanticSearch.searchByExample('function validateEmail(email: string): boolean');

      expect(results.length).toBeGreaterThan(0);
      const validator = results.find(r => r.symbol.name === 'validateEmail');
      expect(validator).toBeDefined();
    });

    it('should extract patterns from class definitions', () => {
      const results = semanticSearch.searchByExample('class UserService implements IUserService');

      expect(results.length).toBeGreaterThan(0);
      const serviceClass = results.find(r =>
        r.symbol.name === 'UserService' && r.symbol.type === 'class'
      );
      expect(serviceClass).toBeDefined();
    });

    it('should handle async function patterns', () => {
      const results = semanticSearch.searchByExample('async function createUser');

      expect(results.length).toBeGreaterThan(0);
      const asyncFunction = results.find(r => r.symbol.name === 'createUser');
      expect(asyncFunction).toBeDefined();
    });
  });

  describe('scoring algorithm', () => {
    it('should give higher scores for exact matches', () => {
      const results = semanticSearch.search('validateEmail');
      const exactMatch = results.find(r => r.symbol.name === 'validateEmail')!;

      expect(exactMatch.score).toBeGreaterThan(0.8);
      expect(exactMatch.matchType).toBe('name');
    });

    it('should consider signature matches in scoring', () => {
      const results = semanticSearch.search('string boolean');

      // Functions with string parameters and boolean returns should score higher
      const functionWithSignature = results.find(r =>
        r.symbol.signature &&
        r.symbol.signature.includes('string') &&
        r.symbol.signature.includes('boolean')
      );

      if (functionWithSignature) {
        expect(functionWithSignature.score).toBeGreaterThan(0.3);
      }
    });

    it('should provide detailed score breakdown', () => {
      const results = semanticSearch.search('validateEmail');
      const result = results[0];

      expect(result.scoreBreakdown).toBeDefined();
      expect(result.scoreBreakdown!.nameMatch).toBeGreaterThan(0);
      expect(result.scoreBreakdown!.totalScore).toBe(result.score);
    });
  });

  describe('edge cases', () => {
    it('should handle empty queries gracefully', () => {
      const results = semanticSearch.search('');
      expect(results).toEqual([]);
    });

    it('should handle queries with no matches', () => {
      const results = semanticSearch.search('nonexistentsymbolname12345');
      expect(results).toEqual([]);
    });

    it('should handle special characters in queries', () => {
      const results = semanticSearch.search('validate@email.com');
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very long queries', () => {
      const longQuery = 'this is a very long query that contains many words and should still work properly even though it might be longer than typical searches';
      const results = semanticSearch.search(longQuery);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('performance', () => {
    it('should complete searches within reasonable time', () => {
      const startTime = Date.now();
      semanticSearch.search('user service function');
      const endTime = Date.now();

      // Should complete within 100ms for small repository
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle large result sets efficiently', () => {
      const results = semanticSearch.search('test', {
        limit: 1000,
        minScore: 0.1
      });

      expect(results.length).toBeLessThanOrEqual(1000);
    });
  });
});

function createMockRepositoryMap(): RepositoryMap {
  const files: CodeFile[] = [
    {
      filePath: 'src/services/user.ts',
      language: 'typescript',
      content: 'export class UserService implements IUserService { ... }',
      symbols: [
        {
          name: 'IUserService',
          type: 'interface',
          filePath: 'src/services/user.ts',
          startLine: 1,
          endLine: 5,
          signature: 'interface IUserService',
          exported: true,
          documentation: 'Interface for user service operations'
        },
        {
          name: 'UserService',
          type: 'class',
          filePath: 'src/services/user.ts',
          startLine: 7,
          endLine: 50,
          signature: 'class UserService implements IUserService',
          exported: true,
          documentation: 'User service implementation for managing users'
        },
        {
          name: 'createUser',
          type: 'method',
          filePath: 'src/services/user.ts',
          startLine: 15,
          endLine: 25,
          signature: 'async createUser(email: string, name: string): Promise<User>',
          exported: false,
          parent: 'UserService',
          documentation: 'Creates a new user with email validation'
        },
        {
          name: 'findUserById',
          type: 'method',
          filePath: 'src/services/user.ts',
          startLine: 27,
          endLine: 30,
          signature: 'async findUserById(id: string): Promise<User | null>',
          exported: false,
          parent: 'UserService'
        }
      ],
      imports: [
        {
          sourceFile: 'src/services/user.ts',
          targetFile: 'src/models/user.ts',
          importedSymbols: ['User'],
          importType: 'named'
        }
      ],
      exports: ['IUserService', 'UserService']
    },
    {
      filePath: 'src/utils/validation.ts',
      language: 'typescript',
      content: 'export function validateEmail(email: string): boolean { ... }',
      symbols: [
        {
          name: 'validateEmail',
          type: 'function',
          filePath: 'src/utils/validation.ts',
          startLine: 5,
          endLine: 8,
          signature: 'function validateEmail(email: string): boolean',
          exported: true,
          documentation: 'Validates email addresses using regex pattern'
        },
        {
          name: 'validatePassword',
          type: 'function',
          filePath: 'src/utils/validation.ts',
          startLine: 10,
          endLine: 13,
          signature: 'function validatePassword(password: string): boolean',
          exported: true,
          documentation: 'Validates password strength and format'
        },
        {
          name: 'ValidationResult',
          type: 'interface',
          filePath: 'src/utils/validation.ts',
          startLine: 15,
          endLine: 18,
          signature: 'interface ValidationResult',
          exported: true,
          documentation: 'Result of validation operations'
        }
      ],
      imports: [],
      exports: ['validateEmail', 'validatePassword', 'ValidationResult']
    },
    {
      filePath: 'src/models/user.ts',
      language: 'typescript',
      content: 'export class User { ... }',
      symbols: [
        {
          name: 'User',
          type: 'class',
          filePath: 'src/models/user.ts',
          startLine: 1,
          endLine: 20,
          signature: 'class User',
          exported: true,
          documentation: 'User model representing a system user'
        },
        {
          name: 'AdminUser',
          type: 'class',
          filePath: 'src/models/user.ts',
          startLine: 22,
          endLine: 35,
          signature: 'class AdminUser extends User',
          exported: true,
          documentation: 'Admin user with additional permissions'
        },
        {
          name: 'getDisplayName',
          type: 'method',
          filePath: 'src/models/user.ts',
          startLine: 8,
          endLine: 11,
          signature: 'getDisplayName(): string',
          exported: false,
          parent: 'User'
        }
      ],
      imports: [],
      exports: ['User', 'AdminUser']
    }
  ];

  return {
    rootPath: '/test/project',
    files,
    imports: files.flatMap(f => f.imports),
    references: [],
    stats: {
      totalFiles: files.length,
      totalSymbols: files.reduce((count, f) => count + f.symbols.length, 0),
      indexedAt: new Date(),
      processingTimeMs: 100
    }
  };
}