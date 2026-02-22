import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolResolver } from '../symbol-resolver';
import { RepositoryMap, RepositoryMapSchema } from '../types';

/**
 * Acceptance tests for SymbolResolver
 * These tests verify that the SymbolResolver meets the acceptance criteria:
 * - SymbolResolver class provides findDefinition(symbolName) and findReferences(symbolName) methods
 * - Resolves symbols across files using the RepositoryMap
 * - Unit tests verify cross-file resolution
 */
describe('SymbolResolver Acceptance Criteria', () => {
  let repositoryMap: RepositoryMap;
  let resolver: SymbolResolver;

  beforeEach(() => {
    // Create a repository map that demonstrates cross-file symbol resolution
    repositoryMap = RepositoryMapSchema.parse({
      rootPath: '/acceptance/project',
      name: 'Acceptance Test Project',
      files: [
        {
          path: 'src/models/User.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'User',
              type: 'interface',
              filePath: 'src/models/User.ts',
              startLine: 1,
              endLine: 8,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              signature: 'interface User { id: number; name: string; email: string; }',
              documentation: 'User interface representing a user entity'
            },
            {
              name: 'UserRole',
              type: 'enum',
              filePath: 'src/models/User.ts',
              startLine: 10,
              endLine: 15,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              signature: 'enum UserRole { ADMIN = "admin", USER = "user" }'
            }
          ]
        },
        {
          path: 'src/services/UserService.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'UserService',
              type: 'class',
              filePath: 'src/services/UserService.ts',
              startLine: 3,
              endLine: 25,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              signature: 'export class UserService'
            },
            {
              name: 'createUser',
              type: 'method',
              filePath: 'src/services/UserService.ts',
              startLine: 5,
              endLine: 10,
              startColumn: 2,
              endColumn: 3,
              parent: 'UserService',
              signature: 'createUser(userData: Partial<User>): Promise<User>'
            },
            {
              name: 'getUserById',
              type: 'method',
              filePath: 'src/services/UserService.ts',
              startLine: 12,
              endLine: 18,
              startColumn: 2,
              endColumn: 3,
              parent: 'UserService',
              signature: 'getUserById(id: number): Promise<User | null>'
            },
            {
              name: 'updateUserRole',
              type: 'method',
              filePath: 'src/services/UserService.ts',
              startLine: 20,
              endLine: 24,
              startColumn: 2,
              endColumn: 3,
              parent: 'UserService',
              signature: 'updateUserRole(userId: number, role: UserRole): Promise<void>'
            }
          ]
        },
        {
          path: 'src/controllers/UserController.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'UserController',
              type: 'class',
              filePath: 'src/controllers/UserController.ts',
              startLine: 5,
              endLine: 30,
              startColumn: 0,
              endColumn: 1,
              exported: true
            },
            {
              name: 'create',
              type: 'method',
              filePath: 'src/controllers/UserController.ts',
              startLine: 10,
              endLine: 15,
              startColumn: 2,
              endColumn: 3,
              parent: 'UserController'
            }
          ]
        },
        {
          path: 'src/utils/validation.ts',
          language: 'typescript',
          symbols: [
            {
              name: 'validateEmail',
              type: 'function',
              filePath: 'src/utils/validation.ts',
              startLine: 1,
              endLine: 5,
              startColumn: 0,
              endColumn: 1,
              exported: true,
              signature: 'export function validateEmail(email: string): boolean'
            },
            {
              name: 'EMAIL_REGEX',
              type: 'constant',
              filePath: 'src/utils/validation.ts',
              startLine: 7,
              endLine: 7,
              startColumn: 0,
              endColumn: 50,
              exported: false
            }
          ]
        }
      ],
      references: [
        // UserService references User interface from models
        {
          symbolName: 'User',
          symbolType: 'interface',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 5,
          sourceColumn: 30,
          targetFile: 'src/models/User.ts',
          targetLine: 1,
          targetColumn: 0,
          referenceType: 'type'
        },
        {
          symbolName: 'User',
          symbolType: 'interface',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 12,
          sourceColumn: 35,
          targetFile: 'src/models/User.ts',
          targetLine: 1,
          targetColumn: 0,
          referenceType: 'type'
        },
        // UserService references UserRole enum
        {
          symbolName: 'UserRole',
          symbolType: 'enum',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 20,
          sourceColumn: 40,
          targetFile: 'src/models/User.ts',
          targetLine: 10,
          targetColumn: 0,
          referenceType: 'type'
        },
        // UserController references UserService
        {
          symbolName: 'UserService',
          symbolType: 'class',
          sourceFile: 'src/controllers/UserController.ts',
          sourceLine: 7,
          sourceColumn: 20,
          targetFile: 'src/services/UserService.ts',
          targetLine: 3,
          targetColumn: 0,
          referenceType: 'instantiation'
        },
        // UserController references createUser method
        {
          symbolName: 'createUser',
          symbolType: 'method',
          sourceFile: 'src/controllers/UserController.ts',
          sourceLine: 12,
          sourceColumn: 25,
          targetFile: 'src/services/UserService.ts',
          targetLine: 5,
          targetColumn: 2,
          referenceType: 'call'
        },
        // UserService references validateEmail from utils
        {
          symbolName: 'validateEmail',
          symbolType: 'function',
          sourceFile: 'src/services/UserService.ts',
          sourceLine: 8,
          sourceColumn: 10,
          targetFile: 'src/utils/validation.ts',
          targetLine: 1,
          targetColumn: 0,
          referenceType: 'call'
        }
      ],
      stats: {
        totalFiles: 4,
        totalSymbols: 8,
        totalReferences: 6,
        totalLines: 100,
        languageBreakdown: { typescript: 4 },
        symbolTypeBreakdown: {
          interface: 1,
          enum: 1,
          class: 2,
          method: 4,
          function: 1,
          constant: 1
        }
      },
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    });

    resolver = new SymbolResolver(repositoryMap);
  });

  describe('SymbolResolver class requirements', () => {
    it('should provide findDefinition(symbolName) method', () => {
      // Acceptance Criteria: SymbolResolver class provides findDefinition(symbolName) method
      expect(resolver).toHaveProperty('findDefinition');
      expect(typeof resolver.findDefinition).toBe('function');

      // Method should accept symbolName parameter and return result
      const result = resolver.findDefinition('User');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('line');
    });

    it('should provide findReferences(symbolName) method', () => {
      // Acceptance Criteria: SymbolResolver class provides findReferences(symbolName) method
      expect(resolver).toHaveProperty('findReferences');
      expect(typeof resolver.findReferences).toBe('function');

      // Method should accept symbolName parameter and return result
      const result = resolver.findReferences('User');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('references');
      expect(Array.isArray(result!.references)).toBe(true);
    });
  });

  describe('Cross-file symbol resolution using RepositoryMap', () => {
    it('should resolve symbols across files using the RepositoryMap', () => {
      // Acceptance Criteria: Resolves symbols across files using the RepositoryMap

      // Test: Find a symbol defined in one file
      const userDefinition = resolver.findDefinition('User');
      expect(userDefinition).not.toBeNull();
      expect(userDefinition!.filePath).toBe('src/models/User.ts');
      expect(userDefinition!.symbol.name).toBe('User');
      expect(userDefinition!.symbol.type).toBe('interface');

      // Test: Find references to that symbol from other files
      const userReferences = resolver.findReferences('User');
      expect(userReferences).not.toBeNull();
      expect(userReferences!.references).toHaveLength(2);

      // All references should be from UserService.ts (cross-file resolution)
      userReferences!.references.forEach(ref => {
        expect(ref.filePath).toBe('src/services/UserService.ts');
        expect(ref.reference.targetFile).toBe('src/models/User.ts');
      });
    });

    it('should verify cross-file resolution for enum types', () => {
      // Test cross-file resolution for enum UserRole
      const userRoleDefinition = resolver.findDefinition('UserRole');
      expect(userRoleDefinition).not.toBeNull();
      expect(userRoleDefinition!.filePath).toBe('src/models/User.ts');

      const userRoleReferences = resolver.findReferences('UserRole');
      expect(userRoleReferences).not.toBeNull();
      expect(userRoleReferences!.references).toHaveLength(1);
      expect(userRoleReferences!.references[0].filePath).toBe('src/services/UserService.ts');
      expect(userRoleReferences!.references[0].reference.targetFile).toBe('src/models/User.ts');
    });

    it('should verify cross-file resolution for class instantiation', () => {
      // Test cross-file resolution for UserService class
      const userServiceDefinition = resolver.findDefinition('UserService');
      expect(userServiceDefinition).not.toBeNull();
      expect(userServiceDefinition!.filePath).toBe('src/services/UserService.ts');

      const userServiceReferences = resolver.findReferences('UserService');
      expect(userServiceReferences).not.toBeNull();
      expect(userServiceReferences!.references).toHaveLength(1);
      expect(userServiceReferences!.references[0].filePath).toBe('src/controllers/UserController.ts');
      expect(userServiceReferences!.references[0].reference.targetFile).toBe('src/services/UserService.ts');
    });

    it('should verify cross-file resolution for method calls', () => {
      // Test cross-file resolution for method calls
      const createUserDefinition = resolver.findDefinition('createUser');
      expect(createUserDefinition).not.toBeNull();
      expect(createUserDefinition!.filePath).toBe('src/services/UserService.ts');
      expect(createUserDefinition!.symbol.parent).toBe('UserService');

      const createUserReferences = resolver.findReferences('createUser');
      expect(createUserReferences).not.toBeNull();
      expect(createUserReferences!.references).toHaveLength(1);
      expect(createUserReferences!.references[0].filePath).toBe('src/controllers/UserController.ts');
      expect(createUserReferences!.references[0].reference.targetFile).toBe('src/services/UserService.ts');
    });

    it('should verify cross-file resolution for function calls', () => {
      // Test cross-file resolution for utility function calls
      const validateEmailDefinition = resolver.findDefinition('validateEmail');
      expect(validateEmailDefinition).not.toBeNull();
      expect(validateEmailDefinition!.filePath).toBe('src/utils/validation.ts');

      const validateEmailReferences = resolver.findReferences('validateEmail');
      expect(validateEmailReferences).not.toBeNull();
      expect(validateEmailReferences!.references).toHaveLength(1);
      expect(validateEmailReferences!.references[0].filePath).toBe('src/services/UserService.ts');
      expect(validateEmailReferences!.references[0].reference.targetFile).toBe('src/utils/validation.ts');
    });
  });

  describe('Unit tests verify cross-file resolution', () => {
    it('should demonstrate complete cross-file dependency chain', () => {
      // Acceptance Criteria: Unit tests verify cross-file resolution

      // Create a dependency chain: Controller -> Service -> Model/Utils
      // This verifies that the SymbolResolver can track complex relationships

      // 1. UserController depends on UserService
      const controllerToService = resolver.findReferencesFromFile('src/controllers/UserController.ts');
      expect(controllerToService).toHaveLength(2); // UserService class + createUser method

      const userServiceRef = controllerToService.find(ref => ref.reference.symbolName === 'UserService');
      expect(userServiceRef).not.toBeNull();
      expect(userServiceRef!.reference.targetFile).toBe('src/services/UserService.ts');

      // 2. UserService depends on User interface and UserRole enum
      const serviceToModel = resolver.findReferencesFromFile('src/services/UserService.ts');
      expect(serviceToModel).toHaveLength(4); // User (2x), UserRole, validateEmail

      const userInterfaceRefs = serviceToModel.filter(ref => ref.reference.symbolName === 'User');
      expect(userInterfaceRefs).toHaveLength(2);
      userInterfaceRefs.forEach(ref => {
        expect(ref.reference.targetFile).toBe('src/models/User.ts');
      });

      const userRoleRef = serviceToModel.find(ref => ref.reference.symbolName === 'UserRole');
      expect(userRoleRef).not.toBeNull();
      expect(userRoleRef!.reference.targetFile).toBe('src/models/User.ts');

      // 3. UserService also depends on validation utilities
      const validateEmailRef = serviceToModel.find(ref => ref.reference.symbolName === 'validateEmail');
      expect(validateEmailRef).not.toBeNull();
      expect(validateEmailRef!.reference.targetFile).toBe('src/utils/validation.ts');
    });

    it('should handle reverse dependency lookup', () => {
      // Test reverse lookup: find what files depend on User.ts
      const dependentsOfUserModel = resolver.findReferencesToFile('src/models/User.ts');
      expect(dependentsOfUserModel).toHaveLength(3); // User (2x) + UserRole

      // All dependencies should come from UserService.ts
      dependentsOfUserModel.forEach(ref => {
        expect(ref.filePath).toBe('src/services/UserService.ts');
      });

      // Test reverse lookup: find what files depend on validation.ts
      const dependentsOfValidation = resolver.findReferencesToFile('src/utils/validation.ts');
      expect(dependentsOfValidation).toHaveLength(1);
      expect(dependentsOfValidation[0].filePath).toBe('src/services/UserService.ts');
      expect(dependentsOfValidation[0].reference.symbolName).toBe('validateEmail');
    });

    it('should provide accurate cross-file statistics', () => {
      // Verify that statistics accurately reflect cross-file relationships
      const stats = resolver.getStatistics();

      expect(stats.totalSymbols).toBe(8);
      expect(stats.totalReferences).toBe(6);
      expect(stats.totalFiles).toBe(4);
      expect(stats.filesWithSymbols).toBe(4);
      expect(stats.filesWithReferences).toBe(2); // Only UserService.ts and UserController.ts have outgoing refs

      // Verify symbol type breakdown matches the repository
      expect(stats.symbolsByType['interface']).toBe(1);
      expect(stats.symbolsByType['enum']).toBe(1);
      expect(stats.symbolsByType['class']).toBe(2);
      expect(stats.symbolsByType['method']).toBe(4);
      expect(stats.symbolsByType['function']).toBe(1);
      expect(stats.symbolsByType['constant']).toBe(1);
    });

    it('should handle all symbol types with cross-file resolution', () => {
      // Test that all symbol types can be resolved across files
      const symbolTypes = ['interface', 'enum', 'class', 'method', 'function', 'constant'];

      symbolTypes.forEach(symbolType => {
        const symbols = resolver.findSymbolsByType(symbolType);
        expect(symbols.length).toBeGreaterThan(0);

        // Each symbol should have proper file path and location info
        symbols.forEach(symbolDef => {
          expect(symbolDef.symbol.type).toBe(symbolType);
          expect(symbolDef.filePath).toMatch(/^src\//);
          expect(symbolDef.line).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Integration with RepositoryMap structure', () => {
    it('should correctly use RepositoryMap files array', () => {
      // Verify that resolver uses all files from the repository map
      const allFiles = repositoryMap.files.map(f => f.path);
      expect(allFiles).toHaveLength(4);

      allFiles.forEach(filePath => {
        const symbolsInFile = resolver.findSymbolsInFile(filePath);
        expect(symbolsInFile.length).toBeGreaterThan(0);
      });
    });

    it('should correctly use RepositoryMap references array', () => {
      // Verify that all references in the repository map are accessible
      expect(repositoryMap.references).toHaveLength(6);

      // Each reference should be findable through the resolver
      repositoryMap.references.forEach(ref => {
        const symbolReferences = resolver.findReferences(ref.symbolName);
        expect(symbolReferences).not.toBeNull();

        const matchingRef = symbolReferences!.references.find(
          r => r.filePath === ref.sourceFile && r.line === ref.sourceLine
        );
        expect(matchingRef).not.toBeNull();
      });
    });

    it('should maintain consistency with RepositoryMap metadata', () => {
      // Verify that resolver statistics match repository map stats
      const stats = resolver.getStatistics();
      const repoStats = repositoryMap.stats!;

      expect(stats.totalFiles).toBe(repoStats.totalFiles);
      expect(stats.totalSymbols).toBe(repoStats.totalSymbols);
      expect(stats.totalReferences).toBe(repoStats.totalReferences);

      // Symbol type breakdown should match
      Object.entries(repoStats.symbolTypeBreakdown!).forEach(([type, count]) => {
        expect(stats.symbolsByType[type]).toBe(count);
      });
    });
  });
});