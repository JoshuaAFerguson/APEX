import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CodebaseIndexer } from '../indexer.js';
import { TypeAwarenessAnalyzer } from '../type-awareness-analyzer.js';
import type { RepositoryMap, CodeFile } from '@apexcli/core/types';

// Mock dependencies
vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn()
    }))
  }
}));

vi.mock('../extractors/typescript-extractor.js', () => ({
  TypeScriptExtractor: {
    getInstance: vi.fn(() => ({
      extractSymbols: vi.fn().mockResolvedValue({
        symbols: [],
        imports: [],
        exports: [],
        references: [],
        errors: []
      })
    }))
  }
}));

vi.mock('../extractors/javascript-extractor.js', () => ({
  JavaScriptExtractor: {
    getInstance: vi.fn(() => ({
      extractSymbols: vi.fn().mockResolvedValue({
        symbols: [],
        imports: [],
        exports: [],
        references: [],
        errors: []
      })
    }))
  }
}));

describe('CodebaseIndexer - Type Enrichment Integration', () => {
  let indexer: CodebaseIndexer;
  let typeAnalyzer: TypeAwarenessAnalyzer;
  let tempDir: string;

  beforeEach(() => {
    // Reset singletons
    CodebaseIndexer.resetInstance?.();
    TypeAwarenessAnalyzer.resetInstance();

    indexer = CodebaseIndexer.getInstance();
    typeAnalyzer = TypeAwarenessAnalyzer.getInstance();
    tempDir = path.join(process.cwd(), 'test-temp', 'indexer-type-test');
  });

  afterEach(async () => {
    vi.clearAllMocks();
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  async function createTempFile(filename: string, content: string): Promise<string> {
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  describe('Basic Type Enrichment', () => {
    test('enriches TypeScript files with type information', async () => {
      const userTs = await createTempFile('user.ts', `
        export interface User {
          id: string;
          name: string;
          email?: string;
          createdAt: Date;
        }

        export type UserRole = 'admin' | 'user' | 'guest';

        export interface UserService<T extends User = User> {
          getUser(id: string): Promise<T | null>;
          createUser(data: Omit<T, 'id' | 'createdAt'>): Promise<T>;
        }
      `);

      const utilsJs = await createTempFile('utils.js', `
        function formatDate(date) {
          return date.toISOString();
        }

        module.exports = { formatDate };
      `);

      // Mock successful parsing for TypeScript
      const mockTypeNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 20, column: 0 },
        startIndex: 0,
        endIndex: 500,
        children: [
          createMockInterfaceNode('User', ['id', 'name', 'email', 'createdAt']),
          createMockTypeAliasNode('UserRole', 'union_type'),
          createMockInterfaceNode('UserService', ['getUser', 'createUser'], ['T'])
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockTypeNode }
      });

      // Index the codebase
      const repositoryMap = await indexer.indexRepository(tempDir);

      // Enrich with type information
      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      expect(enrichedMap.files).toHaveLength(2);

      // TypeScript file should be enriched
      const tsFile = enrichedMap.files.find(f => f.path.endsWith('user.ts'));
      expect(tsFile).toBeDefined();
      expect(tsFile?.metadata?.typeInfo).toBeDefined();

      if (tsFile?.metadata?.typeInfo) {
        expect(tsFile.metadata.typeInfo.interfaceCount).toBe(2); // User, UserService
        expect(tsFile.metadata.typeInfo.typeAliasCount).toBe(1); // UserRole
        expect(tsFile.metadata.typeInfo.genericCount).toBe(1); // UserService<T>
        expect(tsFile.metadata.typeInfo.exportedTypeCount).toBe(3);
      }

      // JavaScript file should remain unchanged
      const jsFile = enrichedMap.files.find(f => f.path.endsWith('utils.js'));
      expect(jsFile).toBeDefined();
      expect(jsFile?.metadata?.typeInfo).toBeUndefined();
    });

    test('handles mixed TypeScript and JavaScript project', async () => {
      const files = [
        { name: 'api.ts', content: `
          export interface ApiResponse<T> {
            data: T;
            status: number;
            message?: string;
          }

          export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
        ` },
        { name: 'client.js', content: `
          class ApiClient {
            constructor(baseUrl) {
              this.baseUrl = baseUrl;
            }

            async get(path) {
              return fetch(\`\${this.baseUrl}\${path}\`);
            }
          }

          module.exports = ApiClient;
        ` },
        { name: 'types.d.ts', content: `
          declare global {
            interface Window {
              API_BASE_URL: string;
            }
          }

          export {};
        ` },
        { name: 'README.md', content: '# Project Documentation' }
      ];

      for (const file of files) {
        await createTempFile(file.name, file.content);
      }

      // Mock parsing for TypeScript files
      const mockTypeNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 200,
        children: [
          createMockInterfaceNode('ApiResponse', ['data', 'status', 'message'], ['T']),
          createMockTypeAliasNode('HttpMethod', 'union_type')
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockDeclareNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 8, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [
          {
            type: 'ambient_declaration',
            children: [createMockInterfaceNode('Window', ['API_BASE_URL'])],
            parent: null,
            previousSibling: null,
            nextSibling: null,
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 5, column: 0 },
            startIndex: 0,
            endIndex: 50
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn()
        .mockResolvedValueOnce({ success: true, tree: { rootNode: mockTypeNode } }) // api.ts
        .mockResolvedValueOnce({ success: false, tree: null }) // client.js
        .mockResolvedValueOnce({ success: true, tree: { rootNode: mockDeclareNode } }) // types.d.ts
        .mockResolvedValueOnce({ success: false, tree: null }); // README.md

      const repositoryMap = await indexer.indexRepository(tempDir);
      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      expect(enrichedMap.files).toHaveLength(4);

      // Check TypeScript files are enriched
      const apiFile = enrichedMap.files.find(f => f.path.endsWith('api.ts'));
      expect(apiFile?.metadata?.typeInfo).toBeDefined();
      expect(apiFile?.metadata?.typeInfo?.interfaceCount).toBe(1);
      expect(apiFile?.metadata?.typeInfo?.typeAliasCount).toBe(1);

      const typesFile = enrichedMap.files.find(f => f.path.endsWith('types.d.ts'));
      expect(typesFile?.metadata?.typeInfo).toBeDefined();

      // Check non-TypeScript files are not enriched
      const jsFile = enrichedMap.files.find(f => f.path.endsWith('client.js'));
      expect(jsFile?.metadata?.typeInfo).toBeUndefined();

      const mdFile = enrichedMap.files.find(f => f.path.endsWith('README.md'));
      expect(mdFile?.metadata?.typeInfo).toBeUndefined();
    });
  });

  describe('Type Dependency Integration', () => {
    test('tracks inter-file type dependencies', async () => {
      await createTempFile('user.ts', `
        export interface User {
          id: string;
          name: string;
          profile: UserProfile;
        }

        export interface UserProfile {
          bio: string;
          avatar?: string;
        }
      `);

      await createTempFile('service.ts', `
        import type { User } from './user';

        export interface UserService {
          getUser(id: string): Promise<User>;
          updateUser(id: string, data: Partial<User>): Promise<User>;
        }

        export type ServiceResponse<T> = {
          success: boolean;
          data: T;
          error?: string;
        };
      `);

      // Mock parsing responses
      const userMockNode = {
        type: 'program',
        children: [
          createMockInterfaceNode('User', ['id', 'name', 'profile']),
          createMockInterfaceNode('UserProfile', ['bio', 'avatar'])
        ],
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 15, column: 0 },
        startIndex: 0,
        endIndex: 300,
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const serviceMockNode = {
        type: 'program',
        children: [
          createMockImportNode('type', 'User', './user'),
          createMockInterfaceNode('UserService', ['getUser', 'updateUser']),
          createMockTypeAliasNode('ServiceResponse', 'object_type', ['T'])
        ],
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 15, column: 0 },
        startIndex: 0,
        endIndex: 400,
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn()
        .mockResolvedValueOnce({ success: true, tree: { rootNode: userMockNode } })
        .mockResolvedValueOnce({ success: true, tree: { rootNode: serviceMockNode } });

      const repositoryMap = await indexer.indexRepository(tempDir);
      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      // Check that type dependencies are tracked
      const userFile = enrichedMap.files.find(f => f.path.endsWith('user.ts'));
      const serviceFile = enrichedMap.files.find(f => f.path.endsWith('service.ts'));

      expect(userFile?.metadata?.typeInfo?.dependencies).toBeDefined();
      expect(serviceFile?.metadata?.typeInfo?.dependencies).toBeDefined();

      // Should track User -> UserProfile dependency
      expect(userFile?.metadata?.typeInfo?.dependencies?.some(d =>
        d.sourceType === 'User' && d.targetType === 'UserProfile'
      )).toBe(true);

      // Should track import dependency
      expect(serviceFile?.metadata?.typeInfo?.imports?.some(i =>
        i.typeName === 'User' && i.fromModule === './user'
      )).toBe(true);
    });

    test('handles complex generic type relationships', async () => {
      await createTempFile('generic.ts', `
        export interface Repository<T, K = string> {
          find(id: K): Promise<T | null>;
          findMany(filter: Partial<T>): Promise<T[]>;
          save(entity: T): Promise<T>;
        }

        export interface UserRepository extends Repository<User, string> {
          findByEmail(email: string): Promise<User | null>;
        }

        interface User {
          id: string;
          email: string;
        }
      `);

      const mockNode = {
        type: 'program',
        children: [
          createMockInterfaceNode('Repository', ['find', 'findMany', 'save'], ['T', 'K']),
          createMockInterfaceNode('UserRepository', ['findByEmail'], [], ['Repository']),
          createMockInterfaceNode('User', ['id', 'email'])
        ],
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 20, column: 0 },
        startIndex: 0,
        endIndex: 500,
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const repositoryMap = await indexer.indexRepository(tempDir);
      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      const genericFile = enrichedMap.files.find(f => f.path.endsWith('generic.ts'));
      expect(genericFile?.metadata?.typeInfo).toBeDefined();

      if (genericFile?.metadata?.typeInfo) {
        expect(genericFile.metadata.typeInfo.interfaceCount).toBe(3);
        expect(genericFile.metadata.typeInfo.genericCount).toBe(2); // T and K parameters

        // Should track inheritance
        expect(genericFile.metadata.typeInfo.dependencies?.some(d =>
          d.sourceType === 'UserRepository' && d.targetType === 'Repository' && d.kind === 'extends'
        )).toBe(true);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('gracefully handles parse errors in type enrichment', async () => {
      await createTempFile('broken.ts', `
        interface User {
          id: string
          name: // missing type
        }

        type Status = |; // malformed

        interface Valid {
          value: number;
        }
      `);

      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockRejectedValue(new Error('Parse error'));

      const repositoryMap = await indexer.indexRepository(tempDir);
      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      // Should not crash and should preserve the original file
      expect(enrichedMap.files).toHaveLength(1);
      const brokenFile = enrichedMap.files[0];
      expect(brokenFile.path).toContain('broken.ts');
      expect(brokenFile.metadata?.typeInfo).toBeUndefined(); // No type info due to parse error
    });

    test('handles missing files during enrichment', async () => {
      const repositoryMap: RepositoryMap = {
        rootPath: tempDir,
        name: 'test-repo',
        files: [
          {
            path: 'nonexistent.ts',
            language: 'typescript',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 0,
            size: 0,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          }
        ],
        references: [],
        stats: {
          totalFiles: 1,
          totalSymbols: 0,
          totalReferences: 0,
          totalLines: 0
        }
      };

      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      // Should handle missing files gracefully
      expect(enrichedMap.files).toHaveLength(1);
      expect(enrichedMap.files[0].path).toBe('nonexistent.ts');
      expect(enrichedMap.files[0].metadata?.typeInfo).toBeUndefined();
    });

    test('preserves existing metadata during enrichment', async () => {
      await createTempFile('user.ts', `
        export interface User {
          id: string;
          name: string;
        }
      `);

      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: createMockInterfaceNode('User', ['id', 'name']) }
      });

      const repositoryMap = await indexer.indexRepository(tempDir);

      // Add existing metadata
      repositoryMap.files[0].metadata = {
        customData: { important: true },
        statistics: { complexity: 5 }
      };

      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);

      const userFile = enrichedMap.files[0];
      expect(userFile.metadata?.customData).toEqual({ important: true });
      expect(userFile.metadata?.statistics).toEqual({ complexity: 5 });
      expect(userFile.metadata?.typeInfo).toBeDefined(); // New type info added
    });
  });

  describe('Performance Integration', () => {
    test('efficiently processes large numbers of TypeScript files', async () => {
      const numFiles = 20;
      const files = Array.from({ length: numFiles }, (_, i) => ({
        name: `file${i}.ts`,
        content: `
          export interface Interface${i} {
            id: string;
            value: number;
            data: Interface${i}Data;
          }

          interface Interface${i}Data {
            content: string;
            timestamp: Date;
          }

          export type Type${i} = 'option1' | 'option2' | 'option3';
        `
      }));

      for (const file of files) {
        await createTempFile(file.name, file.content);
      }

      // Mock parsing for all files
      const mockTreeWrapper = typeAnalyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockImplementation(() =>
        Promise.resolve({
          success: true,
          tree: {
            rootNode: {
              type: 'program',
              children: [
                createMockInterfaceNode('InterfaceX', ['id', 'value', 'data']),
                createMockInterfaceNode('InterfaceXData', ['content', 'timestamp']),
                createMockTypeAliasNode('TypeX', 'union_type')
              ],
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 15, column: 0 },
              startIndex: 0,
              endIndex: 300,
              parent: null,
              previousSibling: null,
              nextSibling: null
            }
          }
        })
      );

      const startTime = Date.now();
      const repositoryMap = await indexer.indexRepository(tempDir);
      const enrichedMap = await typeAnalyzer.enrichRepositoryMap(repositoryMap);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(enrichedMap.files).toHaveLength(numFiles);
      expect(enrichedMap.files.every(f => f.metadata?.typeInfo)).toBe(true);
    });
  });
});

// Helper functions for creating mock AST nodes
function createMockInterfaceNode(
  name: string,
  properties: string[],
  typeParameters: string[] = [],
  extendsClause: string[] = []
): any {
  return {
    type: 'interface_declaration',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: properties.length + 3, column: 0 },
    startIndex: 0,
    endIndex: 100,
    children: [
      {
        type: 'type_identifier',
        startPosition: { row: 0, column: 10 },
        endPosition: { row: 0, column: 10 + name.length },
        startIndex: 10,
        endIndex: 10 + name.length,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      },
      ...properties.map((prop, i) => ({
        type: 'property_signature',
        startPosition: { row: i + 1, column: 2 },
        endPosition: { row: i + 1, column: 20 },
        startIndex: (i + 1) * 20,
        endIndex: (i + 1) * 20 + 18,
        children: [
          {
            type: 'property_identifier',
            startPosition: { row: i + 1, column: 2 },
            endPosition: { row: i + 1, column: 2 + prop.length },
            startIndex: (i + 1) * 20,
            endIndex: (i + 1) * 20 + prop.length,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      }))
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}

function createMockTypeAliasNode(name: string, defType: string, typeParameters: string[] = []): any {
  return {
    type: 'type_alias_declaration',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 1, column: 0 },
    startIndex: 0,
    endIndex: 50,
    children: [
      {
        type: 'type_identifier',
        startPosition: { row: 0, column: 5 },
        endPosition: { row: 0, column: 5 + name.length },
        startIndex: 5,
        endIndex: 5 + name.length,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      }
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}

function createMockImportNode(importType: string, names: string, fromModule: string): any {
  return {
    type: 'import_statement',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 50 },
    startIndex: 0,
    endIndex: 50,
    children: [
      {
        type: 'import_clause',
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null,
        startPosition: { row: 0, column: 7 },
        endPosition: { row: 0, column: 30 },
        startIndex: 7,
        endIndex: 30
      }
    ],
    parent: null,
    previousSibling: null,
    nextSibling: null
  };
}