/**
 * Unit tests for TypeRelationshipMap
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TypeRelationshipMap, type TypeRelationship } from '../type-relationship-map.js';
import type { RepositoryMap, CodeSymbol } from '@apexcli/core/types';

// Mock dependencies
vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn(() => createMockParseResult())
    }))
  }
}));

vi.mock('../symbol-resolver.js', () => ({
  SymbolResolver: vi.fn(() => ({
    findDefinition: vi.fn()
  }))
}));

describe('TypeRelationshipMap', () => {
  let mockRepositoryMap: RepositoryMap;
  let typeRelationshipMap: TypeRelationshipMap;

  beforeEach(() => {
    mockRepositoryMap = createMockRepositoryMap();
    typeRelationshipMap = new TypeRelationshipMap(mockRepositoryMap);
  });

  describe('buildTypeGraph()', () => {
    it('should build type relationship graph', async () => {
      const relationships = await typeRelationshipMap.buildTypeGraph();

      expect(relationships).toBeDefined();
      expect(Array.isArray(relationships)).toBe(true);
      expect(relationships.length).toBeGreaterThanOrEqual(0);
    });

    it('should extract inheritance relationships', async () => {
      // Mock repository map has AdminUser extends User
      const relationships = await typeRelationshipMap.buildTypeGraph();

      const extendsRelationship = relationships.find(rel =>
        rel.kind === 'extends' &&
        rel.sourceType === 'AdminUser' &&
        rel.targetType === 'User'
      );

      expect(extendsRelationship).toBeDefined();
      expect(extendsRelationship!.sourceFile).toMatch(/admin/);
      expect(extendsRelationship!.isExternal).toBe(false);
    });

    it('should extract interface implementation relationships', async () => {
      const relationships = await typeRelationshipMap.buildTypeGraph();

      const implementsRelationship = relationships.find(rel =>
        rel.kind === 'implements' &&
        rel.sourceType === 'UserService' &&
        rel.targetType === 'IUserService'
      );

      expect(implementsRelationship).toBeDefined();
      expect(implementsRelationship!.isExternal).toBe(false);
    });

    it('should extract function parameter type relationships', async () => {
      const relationships = await typeRelationshipMap.buildTypeGraph();

      const acceptsRelationship = relationships.find(rel =>
        rel.kind === 'accepts' &&
        rel.targetType === 'User'
      );

      expect(acceptsRelationship).toBeDefined();
    });

    it('should extract return type relationships', async () => {
      const relationships = await typeRelationshipMap.buildTypeGraph();

      const returnsRelationship = relationships.find(rel =>
        rel.kind === 'returns' &&
        rel.targetType === 'User'
      );

      expect(returnsRelationship).toBeDefined();
    });

    it('should handle external type dependencies', async () => {
      const relationships = await typeRelationshipMap.buildTypeGraph();

      const externalRelationships = relationships.filter(rel => rel.isExternal);
      expect(externalRelationships).toBeDefined();
      // External relationships might include built-in types like string, boolean, etc.
    });
  });

  describe('getImplementations()', () => {
    beforeEach(async () => {
      await typeRelationshipMap.buildTypeGraph();
    });

    it('should find all implementations of an interface', async () => {
      const implementations = typeRelationshipMap.getImplementations('IUserService');

      expect(implementations.length).toBeGreaterThan(0);
      const userServiceImpl = implementations.find(impl =>
        impl.symbol.name === 'UserService'
      );
      expect(userServiceImpl).toBeDefined();
    });

    it('should find all classes that extend a base class', async () => {
      const implementations = typeRelationshipMap.getImplementations('User');

      expect(implementations.length).toBeGreaterThan(0);
      const adminUserImpl = implementations.find(impl =>
        impl.symbol.name === 'AdminUser'
      );
      expect(adminUserImpl).toBeDefined();
    });

    it('should return empty array for non-existent types', async () => {
      const implementations = typeRelationshipMap.getImplementations('NonExistentType');
      expect(implementations).toEqual([]);
    });
  });

  describe('getInheritanceChain()', () => {
    beforeEach(async () => {
      await typeRelationshipMap.buildTypeGraph();
    });

    it('should build complete inheritance chain', async () => {
      const chain = typeRelationshipMap.getInheritanceChain('AdminUser');

      expect(chain.length).toBeGreaterThan(1);

      // Should include the type itself and its ancestors
      const typeNames = chain.map(def => def.symbol.name);
      expect(typeNames).toContain('AdminUser');
      expect(typeNames).toContain('User');
    });

    it('should handle types with no inheritance', async () => {
      const chain = typeRelationshipMap.getInheritanceChain('IUserService');

      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain[0].symbol.name).toBe('IUserService');
    });

    it('should return empty chain for non-existent types', async () => {
      const chain = typeRelationshipMap.getInheritanceChain('NonExistentType');
      expect(chain).toEqual([]);
    });
  });

  describe('getUsages()', () => {
    beforeEach(async () => {
      await typeRelationshipMap.buildTypeGraph();
    });

    it('should find all usages of a type', async () => {
      const usages = typeRelationshipMap.getUsages('User');

      expect(usages).toBeDefined();
      expect(Array.isArray(usages)).toBe(true);

      // Should find usages in function parameters, return types, etc.
      if (usages.length > 0) {
        const usage = usages[0];
        expect(usage.symbol).toBeDefined();
        expect(usage.usage).toBeDefined();
        expect(usage.usage.usageKind).toBeOneOf(['parameter', 'return', 'property', 'variable']);
      }
    });

    it('should return empty array for unused types', async () => {
      const usages = typeRelationshipMap.getUsages('UnusedType');
      expect(usages).toEqual([]);
    });
  });

  describe('getHierarchy()', () => {
    beforeEach(async () => {
      await typeRelationshipMap.buildTypeGraph();
    });

    it('should provide complete type hierarchy information', async () => {
      const hierarchy = typeRelationshipMap.getHierarchy('User');

      expect(hierarchy.type).toBe('User');
      expect(Array.isArray(hierarchy.parents)).toBe(true);
      expect(Array.isArray(hierarchy.children)).toBe(true);
      expect(Array.isArray(hierarchy.ancestors)).toBe(true);
      expect(Array.isArray(hierarchy.descendants)).toBe(true);
      expect(Array.isArray(hierarchy.interfaces)).toBe(true);
      expect(Array.isArray(hierarchy.implementors)).toBe(true);
    });

    it('should cache hierarchy information', async () => {
      const hierarchy1 = typeRelationshipMap.getHierarchy('User');
      const hierarchy2 = typeRelationshipMap.getHierarchy('User');

      // Should return the same object (cached)
      expect(hierarchy1).toBe(hierarchy2);
    });
  });

  describe('getRelationships()', () => {
    beforeEach(async () => {
      await typeRelationshipMap.buildTypeGraph();
    });

    it('should find all relationships for a type', async () => {
      const relationships = typeRelationshipMap.getRelationships('User');

      expect(relationships.length).toBeGreaterThan(0);

      // Should find relationships where User is either source or target
      const hasAsSource = relationships.some(rel => rel.sourceType === 'User');
      const hasAsTarget = relationships.some(rel => rel.targetType === 'User');

      expect(hasAsSource || hasAsTarget).toBe(true);
    });

    it('should return empty array for unknown types', async () => {
      const relationships = typeRelationshipMap.getRelationships('UnknownType');
      expect(relationships).toEqual([]);
    });
  });

  describe('findCircularDependencies()', () => {
    beforeEach(async () => {
      await typeRelationshipMap.buildTypeGraph();
    });

    it('should detect circular dependencies in type hierarchy', async () => {
      const cycles = typeRelationshipMap.findCircularDependencies();

      expect(Array.isArray(cycles)).toBe(true);
      // Our test data should not have circular dependencies
      expect(cycles.length).toBe(0);
    });

    it('should handle complex inheritance chains without false positives', async () => {
      const cycles = typeRelationshipMap.findCircularDependencies();

      // AdminUser -> User should not be considered circular
      const hasFalsePositive = cycles.some(cycle =>
        cycle.includes('AdminUser') && cycle.includes('User') && cycle.length === 2
      );
      expect(hasFalsePositive).toBe(false);
    });
  });

  describe('type analysis edge cases', () => {
    it('should handle generic types', async () => {
      // Add a generic type to the repository map
      const genericFile = {
        filePath: 'src/generic.ts',
        language: 'typescript' as const,
        content: 'class Container<T> { ... }',
        symbols: [
          {
            name: 'Container',
            type: 'class' as const,
            filePath: 'src/generic.ts',
            startLine: 1,
            endLine: 5,
            signature: 'class Container<T>',
            exported: true
          }
        ],
        imports: [],
        exports: []
      };

      mockRepositoryMap.files.push(genericFile);
      const relationships = await typeRelationshipMap.buildTypeGraph();

      // Should handle generic types without errors
      expect(relationships).toBeDefined();
    });

    it('should handle union and intersection types', async () => {
      const relationships = await typeRelationshipMap.buildTypeGraph();
      // Should complete without throwing errors
      expect(relationships).toBeDefined();
    });

    it('should handle deeply nested type hierarchies', async () => {
      // Add deeply nested hierarchy
      const deepHierarchy = {
        filePath: 'src/deep.ts',
        language: 'typescript' as const,
        content: 'class Level1 extends Level2 { ... }',
        symbols: [
          {
            name: 'Level1',
            type: 'class' as const,
            filePath: 'src/deep.ts',
            startLine: 1,
            endLine: 3,
            exported: true
          },
          {
            name: 'Level2',
            type: 'class' as const,
            filePath: 'src/deep.ts',
            startLine: 5,
            endLine: 7,
            exported: true
          }
        ],
        imports: [],
        exports: []
      };

      mockRepositoryMap.files.push(deepHierarchy);
      const relationships = await typeRelationshipMap.buildTypeGraph();

      expect(relationships).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should build type graph within reasonable time', async () => {
      const startTime = Date.now();
      await typeRelationshipMap.buildTypeGraph();
      const endTime = Date.now();

      // Should complete within 200ms for small repository
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle large numbers of types efficiently', async () => {
      // Add many types to test performance
      for (let i = 0; i < 100; i++) {
        mockRepositoryMap.files.push({
          filePath: `src/type${i}.ts`,
          language: 'typescript',
          content: `class Type${i} { }`,
          symbols: [
            {
              name: `Type${i}`,
              type: 'class',
              filePath: `src/type${i}.ts`,
              startLine: 1,
              endLine: 3,
              exported: true
            }
          ],
          imports: [],
          exports: []
        });
      }

      const startTime = Date.now();
      await typeRelationshipMap.buildTypeGraph();
      const endTime = Date.now();

      // Should still complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

function createMockRepositoryMap(): RepositoryMap {
  return {
    rootPath: '/test/project',
    files: [
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
            documentation: 'Base user class'
          },
          {
            name: 'AdminUser',
            type: 'class',
            filePath: 'src/models/user.ts',
            startLine: 22,
            endLine: 35,
            signature: 'class AdminUser extends User',
            exported: true,
            documentation: 'Admin user with extended permissions'
          }
        ],
        imports: [],
        exports: ['User', 'AdminUser']
      },
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
            documentation: 'User service interface'
          },
          {
            name: 'UserService',
            type: 'class',
            filePath: 'src/services/user.ts',
            startLine: 7,
            endLine: 40,
            signature: 'class UserService implements IUserService',
            exported: true,
            documentation: 'User service implementation'
          },
          {
            name: 'createUser',
            type: 'method',
            filePath: 'src/services/user.ts',
            startLine: 10,
            endLine: 15,
            signature: 'async createUser(email: string, name: string): Promise<User>',
            parent: 'UserService',
            exported: false
          },
          {
            name: 'findUser',
            type: 'method',
            filePath: 'src/services/user.ts',
            startLine: 17,
            endLine: 20,
            signature: 'async findUser(id: string): Promise<User | null>',
            parent: 'UserService',
            exported: false
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
    references: [],
    stats: {
      totalFiles: 2,
      totalSymbols: 6,
      indexedAt: new Date(),
      processingTimeMs: 100
    }
  };
}

function createMockParseResult() {
  return {
    success: true,
    tree: {
      rootNode: {
        type: 'program',
        children: [
          {
            type: 'class_declaration',
            children: [
              {
                type: 'identifier',
                text: 'AdminUser'
              },
              {
                type: 'extends_clause',
                children: [
                  {
                    type: 'identifier',
                    text: 'User'
                  }
                ]
              }
            ]
          },
          {
            type: 'class_declaration',
            children: [
              {
                type: 'identifier',
                text: 'UserService'
              },
              {
                type: 'implements_clause',
                children: [
                  {
                    type: 'identifier',
                    text: 'IUserService'
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  };
}