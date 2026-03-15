/**
 * Unit tests for ReferenceExtractor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReferenceExtractor } from '../reference-extractor.js';
import type { RepositoryMap, SymbolReference } from '@apexcli/core/types';

// Mock the TreeSitterWrapper
vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn((sourceCode: string) => {
        return createMockParseResult(sourceCode);
      })
    }))
  }
}));

// Mock the SymbolResolver
vi.mock('../symbol-resolver.js', () => ({
  SymbolResolver: vi.fn(() => ({
    findDefinition: vi.fn((symbolName: string) => {
      if (symbolName === 'validateEmail') {
        return Promise.resolve({
          filePath: 'src/utils/validation.ts',
          startLine: 5,
          endLine: 8,
          symbol: {
            name: 'validateEmail',
            type: 'function',
            filePath: 'src/utils/validation.ts',
            startLine: 5,
            endLine: 8
          }
        });
      }
      return Promise.resolve(null);
    })
  }))
}));

describe('ReferenceExtractor', () => {
  let mockRepositoryMap: RepositoryMap;
  let referenceExtractor: ReferenceExtractor;

  beforeEach(() => {
    mockRepositoryMap = createMockRepositoryMap();
    referenceExtractor = new ReferenceExtractor(mockRepositoryMap);
  });

  describe('extractReferencesFromFile()', () => {
    it('should extract function call references', async () => {
      const sourceCode = `
import { validateEmail } from './validation';

function createUser(email: string) {
  if (!validateEmail(email)) {
    throw new Error('Invalid email');
  }
  return new User(email);
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      expect(references.length).toBeGreaterThan(0);

      // Should find validateEmail call
      const validateEmailRef = references.find(ref =>
        ref.symbolName === 'validateEmail' && ref.referenceType === 'call'
      );
      expect(validateEmailRef).toBeDefined();
      expect(validateEmailRef!.sourceFile).toBe('src/services/user.ts');
      expect(validateEmailRef!.sourceLine).toBeGreaterThan(0);
    });

    it('should extract import references', async () => {
      const sourceCode = `
import { validateEmail, User } from './validation';
import AuthService from './auth';
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      // Should find import references
      const importRefs = references.filter(ref => ref.referenceType === 'import');
      expect(importRefs.length).toBeGreaterThanOrEqual(2);

      const validateEmailImport = importRefs.find(ref => ref.symbolName === 'validateEmail');
      expect(validateEmailImport).toBeDefined();
      expect(validateEmailImport!.sourceFile).toBe('src/services/user.ts');
    });

    it('should extract class instantiation references', async () => {
      const sourceCode = `
import { User } from './models/user';

function createUser() {
  return new User('test@example.com', 'Test User');
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      const newUserRef = references.find(ref =>
        ref.symbolName === 'User' && ref.referenceType === 'instantiation'
      );
      expect(newUserRef).toBeDefined();
    });

    it('should extract property access references', async () => {
      const sourceCode = `
function getUsername(user: User) {
  return user.name || user.email.split('@')[0];
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      const propertyRefs = references.filter(ref =>
        ['name', 'email'].includes(ref.symbolName) && ref.referenceType === 'read'
      );
      expect(propertyRefs.length).toBeGreaterThan(0);
    });

    it('should extract type references', async () => {
      const sourceCode = `
import { User } from './models/user';

function processUser(user: User): User {
  return user;
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      const typeRefs = references.filter(ref =>
        ref.symbolName === 'User' && ref.referenceType === 'type'
      );
      expect(typeRefs.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle assignment references', async () => {
      const sourceCode = `
let currentUser = null;

function setUser(user: User) {
  currentUser = user;
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      const assignmentRef = references.find(ref =>
        ref.symbolName === 'currentUser' && ref.referenceType === 'write'
      );
      expect(assignmentRef).toBeDefined();
    });

    it('should extract inheritance references', async () => {
      const sourceCode = `
import { User } from './user';

export class AdminUser extends User {
  constructor(email: string, name: string, permissions: string[]) {
    super(email, name);
    this.permissions = permissions;
  }
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/models/admin.ts',
        sourceCode,
        'typescript'
      );

      const extendsRef = references.find(ref =>
        ref.symbolName === 'User' && ref.referenceType === 'extension'
      );
      expect(extendsRef).toBeDefined();
    });

    it('should handle interface implementation references', async () => {
      const sourceCode = `
import { IUserService } from './interfaces';

export class UserService implements IUserService {
  async createUser(email: string) {
    // implementation
  }
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );

      const implementsRef = references.find(ref =>
        ref.symbolName === 'IUserService' && ref.referenceType === 'implementation'
      );
      expect(implementsRef).toBeDefined();
    });

    it('should calculate confidence scores for references', async () => {
      const sourceCode = `
import { validateEmail } from './validation';

function test() {
  validateEmail('test@example.com');
}
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/test.ts',
        sourceCode,
        'typescript'
      );

      references.forEach(ref => {
        expect(ref.confidence).toBeGreaterThan(0);
        expect(ref.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should handle dynamic references with lower confidence', async () => {
      const sourceCode = `
function dynamicAccess(obj: any, prop: string) {
  return obj[prop];
}

const methodName = 'validateEmail';
validation[methodName]('test@example.com');
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/test.ts',
        sourceCode,
        'typescript'
      );

      const dynamicRefs = references.filter(ref => ref.isDynamic);
      if (dynamicRefs.length > 0) {
        expect(dynamicRefs[0].confidence).toBeLessThan(0.8);
      }
    });

    it('should handle parse errors gracefully', async () => {
      const invalidSourceCode = `
import { incomplete syntax error
function broken( {
`;

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/broken.ts',
        invalidSourceCode,
        'typescript'
      );

      // Should not throw and return empty array
      expect(references).toBeDefined();
      expect(Array.isArray(references)).toBe(true);
    });
  });

  describe('resolveReference()', () => {
    it('should resolve references to their definitions with high confidence', async () => {
      const reference: SymbolReference = {
        symbolName: 'validateEmail',
        sourceFile: 'src/services/user.ts',
        sourceLine: 10,
        targetFile: 'unknown',
        referenceType: 'call'
      };

      const resolution = await referenceExtractor.resolveReference(reference);

      expect(resolution).toBeDefined();
      expect(resolution!.definition.symbol.name).toBe('validateEmail');
      expect(resolution!.confidence).toBeGreaterThan(0.8);
      expect(resolution!.method).toBe('exact');
    });

    it('should return null for unresolvable references', async () => {
      const reference: SymbolReference = {
        symbolName: 'nonExistentSymbol',
        sourceFile: 'src/test.ts',
        sourceLine: 5,
        targetFile: 'unknown',
        referenceType: 'call'
      };

      const resolution = await referenceExtractor.resolveReference(reference);
      expect(resolution).toBeNull();
    });

    it('should handle resolution errors gracefully', async () => {
      const reference: SymbolReference = {
        symbolName: 'validateEmail',
        sourceFile: 'src/services/user.ts',
        sourceLine: 10,
        targetFile: 'unknown',
        referenceType: 'call'
      };

      // Mock resolver to throw error
      const originalResolver = referenceExtractor['resolver'];
      referenceExtractor['resolver'] = {
        findDefinition: vi.fn(() => {
          throw new Error('Resolution error');
        })
      } as any;

      const resolution = await referenceExtractor.resolveReference(reference);
      expect(resolution).toBeNull();

      // Restore original resolver
      referenceExtractor['resolver'] = originalResolver;
    });
  });

  describe('updateRepositoryMapReferences()', () => {
    it('should update repository map with extracted references', async () => {
      const initialRefCount = mockRepositoryMap.references.length;

      await referenceExtractor.updateRepositoryMapReferences('src/services/user.ts');

      expect(mockRepositoryMap.references.length).toBeGreaterThan(initialRefCount);
    });

    it('should avoid duplicate references', async () => {
      // Add the same reference twice
      await referenceExtractor.updateRepositoryMapReferences('src/services/user.ts');
      const countAfterFirst = mockRepositoryMap.references.length;

      await referenceExtractor.updateRepositoryMapReferences('src/services/user.ts');
      const countAfterSecond = mockRepositoryMap.references.length;

      // Should not have duplicates
      expect(countAfterSecond).toBe(countAfterFirst);
    });

    it('should handle missing files gracefully', async () => {
      await expect(
        referenceExtractor.updateRepositoryMapReferences('src/nonexistent.ts')
      ).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty source code', async () => {
      const references = await referenceExtractor.extractReferencesFromFile(
        'src/empty.ts',
        '',
        'typescript'
      );

      expect(references).toEqual([]);
    });

    it('should handle very large files', async () => {
      const largeSourceCode = 'const x = 1;\n'.repeat(10000);

      const references = await referenceExtractor.extractReferencesFromFile(
        'src/large.ts',
        largeSourceCode,
        'typescript'
      );

      expect(references).toBeDefined();
      expect(Array.isArray(references)).toBe(true);
    });

    it('should handle unsupported languages gracefully', async () => {
      const references = await referenceExtractor.extractReferencesFromFile(
        'src/test.xyz',
        'some content',
        'unknown' as any
      );

      expect(references).toBeDefined();
      expect(Array.isArray(references)).toBe(true);
    });
  });

  describe('performance', () => {
    it('should extract references within reasonable time', async () => {
      const sourceCode = `
import { validateEmail, User } from './validation';

class UserService {
  async createUser(email: string, name: string) {
    if (!validateEmail(email)) {
      throw new Error('Invalid email');
    }
    return new User(email, name);
  }
}
`;

      const startTime = Date.now();
      await referenceExtractor.extractReferencesFromFile(
        'src/services/user.ts',
        sourceCode,
        'typescript'
      );
      const endTime = Date.now();

      // Should complete within 100ms for small file
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

function createMockRepositoryMap(): RepositoryMap {
  return {
    rootPath: '/test/project',
    files: [
      {
        filePath: 'src/services/user.ts',
        language: 'typescript',
        content: 'export class UserService { ... }',
        symbols: [],
        imports: [],
        exports: []
      },
      {
        filePath: 'src/utils/validation.ts',
        language: 'typescript',
        content: 'export function validateEmail() { ... }',
        symbols: [
          {
            name: 'validateEmail',
            type: 'function',
            filePath: 'src/utils/validation.ts',
            startLine: 5,
            endLine: 8,
            exported: true
          }
        ],
        imports: [],
        exports: []
      }
    ],
    imports: [],
    references: [],
    stats: {
      totalFiles: 2,
      totalSymbols: 1,
      indexedAt: new Date(),
      processingTimeMs: 50
    }
  };
}

function createMockParseResult(sourceCode: string) {
  // Create a simplified mock AST based on source code patterns
  const hasImport = sourceCode.includes('import');
  const hasClass = sourceCode.includes('class ');
  const hasFunction = sourceCode.includes('function ') || sourceCode.includes('=>');
  const hasCall = /\w+\s*\(/.test(sourceCode);

  return {
    success: true,
    tree: {
      rootNode: createMockNode(sourceCode)
    }
  };
}

function createMockNode(sourceCode: string): any {
  return {
    type: 'program',
    startIndex: 0,
    endIndex: sourceCode.length,
    startPosition: { row: 0, column: 0 },
    children: [
      // Mock import node
      ...(sourceCode.includes('import') ? [{
        type: 'import_statement',
        startIndex: sourceCode.indexOf('import'),
        endIndex: sourceCode.indexOf(';', sourceCode.indexOf('import')) + 1,
        startPosition: { row: 1, column: 0 },
        children: [
          {
            type: 'identifier',
            text: 'validateEmail',
            startIndex: sourceCode.indexOf('validateEmail'),
            endIndex: sourceCode.indexOf('validateEmail') + 'validateEmail'.length,
            startPosition: { row: 1, column: 9 }
          }
        ]
      }] : []),
      // Mock function call node
      ...(sourceCode.includes('validateEmail(') ? [{
        type: 'call_expression',
        startIndex: sourceCode.indexOf('validateEmail('),
        endIndex: sourceCode.indexOf(')', sourceCode.indexOf('validateEmail(')) + 1,
        startPosition: { row: 4, column: 7 },
        children: [
          {
            type: 'identifier',
            text: 'validateEmail',
            startIndex: sourceCode.indexOf('validateEmail('),
            endIndex: sourceCode.indexOf('validateEmail(') + 'validateEmail'.length,
            startPosition: { row: 4, column: 7 }
          }
        ]
      }] : [])
    ]
  };
}