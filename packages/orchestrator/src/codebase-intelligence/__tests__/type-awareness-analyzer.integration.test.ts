import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TypeAwarenessAnalyzer } from '../type-awareness-analyzer.js';
import type { TypeInformation, TypeAnalysisOptions } from '../type-awareness-analyzer.js';

describe('TypeAwarenessAnalyzer Integration Tests', () => {
  let analyzer: TypeAwarenessAnalyzer;
  let tempDir: string;

  beforeEach(() => {
    TypeAwarenessAnalyzer.resetInstance();
    analyzer = TypeAwarenessAnalyzer.getInstance();
    tempDir = path.join(process.cwd(), 'test-temp', 'type-analysis');
  });

  afterEach(async () => {
    // Clean up temporary files
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

  describe('Basic TypeScript Analysis', () => {
    test('analyzes simple interface', async () => {
      const content = `
        interface User {
          id: number;
          name: string;
          email?: string;
          readonly createdAt: Date;
        }
      `;

      const result = await analyzer.analyzeContent(content, 'user.ts');

      expect(result.interfaces).toHaveLength(1);
      const userInterface = result.interfaces[0];
      expect(userInterface.name).toBe('User');
      expect(userInterface.properties).toHaveLength(4);

      const properties = userInterface.properties;
      expect(properties[0].name).toBe('id');
      expect(properties[0].type.raw).toBe('number');
      expect(properties[0].optional).toBe(false);
      expect(properties[0].readonly).toBe(false);

      expect(properties[2].name).toBe('email');
      expect(properties[2].optional).toBe(true);

      expect(properties[3].name).toBe('createdAt');
      expect(properties[3].readonly).toBe(true);
    });

    test('analyzes type aliases', async () => {
      const content = `
        type Status = 'pending' | 'approved' | 'rejected';
        type UserRole = 'admin' | 'user' | 'guest';
        type Callback<T> = (data: T) => void;
      `;

      const result = await analyzer.analyzeContent(content, 'types.ts');

      expect(result.typeAliases).toHaveLength(3);

      const statusType = result.typeAliases.find(t => t.name === 'Status');
      expect(statusType).toBeDefined();
      expect(statusType?.definition.kind).toBe('union');

      const callbackType = result.typeAliases.find(t => t.name === 'Callback');
      expect(callbackType).toBeDefined();
      expect(callbackType?.typeParameters).toHaveLength(1);
      expect(callbackType?.typeParameters[0].name).toBe('T');
    });

    test('analyzes generic interfaces', async () => {
      const content = `
        interface Container<T extends string | number> {
          value: T;
          getValue(): T;
          setValue(value: T): void;
        }

        interface Repository<T, K = string> {
          findById(id: K): Promise<T | null>;
          save(entity: T): Promise<T>;
        }
      `;

      const result = await analyzer.analyzeContent(content, 'generics.ts');

      expect(result.interfaces).toHaveLength(2);

      const containerInterface = result.interfaces.find(i => i.name === 'Container');
      expect(containerInterface).toBeDefined();
      expect(containerInterface?.typeParameters).toHaveLength(1);
      expect(containerInterface?.typeParameters[0].name).toBe('T');
      expect(containerInterface?.typeParameters[0].constraint).toBeDefined();

      const repoInterface = result.interfaces.find(i => i.name === 'Repository');
      expect(repoInterface).toBeDefined();
      expect(repoInterface?.typeParameters).toHaveLength(2);
      expect(repoInterface?.typeParameters[1].defaultType).toBeDefined();
    });

    test('analyzes interface inheritance', async () => {
      const content = `
        interface BaseEntity {
          id: string;
          createdAt: Date;
        }

        interface User extends BaseEntity {
          name: string;
          email: string;
        }

        interface AdminUser extends User {
          permissions: string[];
        }
      `;

      const result = await analyzer.analyzeContent(content, 'inheritance.ts');

      expect(result.interfaces).toHaveLength(3);

      const userInterface = result.interfaces.find(i => i.name === 'User');
      expect(userInterface).toBeDefined();
      expect(userInterface?.extends).toContain('BaseEntity');

      const adminInterface = result.interfaces.find(i => i.name === 'AdminUser');
      expect(adminInterface).toBeDefined();
      expect(adminInterface?.extends).toContain('User');
    });

    test('analyzes complex type annotations', async () => {
      const content = `
        interface ApiResponse<T> {
          data: T;
          meta: {
            page: number;
            total: number;
            hasMore: boolean;
          };
          errors?: string[];
        }

        type EventHandler = (event: {
          type: string;
          payload: any;
          timestamp: Date;
        }) => void | Promise<void>;

        interface Service {
          processData<T extends { id: string }>(
            items: T[],
            callback: (item: T) => boolean
          ): Promise<T[]>;
        }
      `;

      const result = await analyzer.analyzeContent(content, 'complex.ts');

      expect(result.interfaces).toHaveLength(2);
      expect(result.typeAliases).toHaveLength(1);

      const apiResponse = result.interfaces.find(i => i.name === 'ApiResponse');
      expect(apiResponse).toBeDefined();
      expect(apiResponse?.properties).toHaveLength(3);

      const eventHandler = result.typeAliases.find(t => t.name === 'EventHandler');
      expect(eventHandler).toBeDefined();
      expect(eventHandler?.definition.kind).toBe('function');
    });
  });

  describe('Import/Export Analysis', () => {
    test('analyzes type imports', async () => {
      const content = `
        import type { User } from './user';
        import { type ApiResponse, Status } from './api';
        import type * as Types from './types';
      `;

      const result = await analyzer.analyzeContent(content, 'imports.ts');

      expect(result.typeImports).toHaveLength(3);

      const userImport = result.typeImports.find(i => i.typeName === 'User');
      expect(userImport).toBeDefined();
      expect(userImport?.typeOnly).toBe(true);
      expect(userImport?.fromModule).toBe('./user');

      const typesImport = result.typeImports.find(i => i.typeName.includes('Types'));
      expect(typesImport).toBeDefined();
      expect(typesImport?.typeOnly).toBe(true);
    });

    test('analyzes type exports', async () => {
      const content = `
        export interface User {
          id: string;
          name: string;
        }

        export type Status = 'active' | 'inactive';
        export default interface DefaultUser extends User {}
        export type { User as UserType };
      `;

      const result = await analyzer.analyzeContent(content, 'exports.ts');

      expect(result.typeExports).toHaveLength(4);

      const defaultExport = result.typeExports.find(e => e.isDefault);
      expect(defaultExport).toBeDefined();
      expect(defaultExport?.typeName).toBe('DefaultUser');

      const namedExports = result.typeExports.filter(e => !e.isDefault);
      expect(namedExports).toHaveLength(3);
    });
  });

  describe('Type Dependencies', () => {
    test('tracks type usage relationships', async () => {
      const content = `
        interface BaseUser {
          id: string;
        }

        interface User extends BaseUser {
          profile: UserProfile;
          settings: UserSettings;
        }

        interface UserProfile {
          name: string;
          avatar?: string;
        }

        interface UserSettings {
          theme: 'light' | 'dark';
          notifications: boolean;
        }
      `;

      const result = await analyzer.analyzeContent(content, 'dependencies.ts');

      expect(result.typeDependencies).toHaveLength(3); // User -> BaseUser, User -> UserProfile, User -> UserSettings

      const extendsDependency = result.typeDependencies.find(d =>
        d.sourceType === 'User' && d.targetType === 'BaseUser' && d.kind === 'extends'
      );
      expect(extendsDependency).toBeDefined();

      const propertyDependencies = result.typeDependencies.filter(d =>
        d.sourceType === 'User' && d.kind === 'property'
      );
      expect(propertyDependencies).toHaveLength(2);
    });
  });

  describe('Repository Map Integration', () => {
    test('enriches repository map with type information', async () => {
      const tsFile = await createTempFile('user.ts', `
        export interface User {
          id: string;
          name: string;
          email: string;
        }

        export type UserRole = 'admin' | 'user';
      `);

      const jsFile = await createTempFile('utils.js', `
        const helper = () => 'hello';
        module.exports = helper;
      `);

      const mockRepoMap = {
        rootPath: tempDir,
        name: 'test-repo',
        files: [
          {
            path: path.relative(tempDir, tsFile),
            language: 'typescript',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 8,
            size: 120,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          },
          {
            path: path.relative(tempDir, jsFile),
            language: 'javascript',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 3,
            size: 60,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          }
        ],
        references: [],
        stats: {
          totalFiles: 2,
          totalSymbols: 0,
          totalReferences: 0,
          totalLines: 11
        }
      };

      const enrichedMap = await analyzer.enrichRepositoryMap(mockRepoMap);

      expect(enrichedMap.files).toHaveLength(2);

      // TypeScript file should be enriched
      const tsFileEnriched = enrichedMap.files.find(f => f.path.endsWith('.ts'));
      expect(tsFileEnriched).toBeDefined();
      expect(tsFileEnriched?.metadata?.typeInfo).toBeDefined();
      expect(tsFileEnriched?.metadata?.typeInfo.interfaceCount).toBe(1);
      expect(tsFileEnriched?.metadata?.typeInfo.typeAliasCount).toBe(1);

      // JavaScript file should remain unchanged
      const jsFileUnchanged = enrichedMap.files.find(f => f.path.endsWith('.js'));
      expect(jsFileUnchanged).toBeDefined();
      expect(jsFileUnchanged?.path).toBe(path.relative(tempDir, jsFile));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles malformed TypeScript gracefully', async () => {
      const content = `
        interface User {
          id: string
          name: // missing type
        }

        type Status = |; // malformed union
      `;

      const result = await analyzer.analyzeContent(content, 'malformed.ts');

      // Should not crash and should provide some analysis
      expect(result.filePath).toBe('malformed.ts');
      expect(result.errors).toBeDefined();
    });

    test('handles large files efficiently', async () => {
      const largeInterface = Array.from({ length: 100 }, (_, i) =>
        `  prop${i}: string;`
      ).join('\n');

      const content = `
        interface LargeInterface {
${largeInterface}
        }

        ${Array.from({ length: 50 }, (_, i) => `
          interface Interface${i} {
            id: string;
            value: number;
          }
        `).join('\n')}
      `;

      const startTime = Date.now();
      const result = await analyzer.analyzeContent(content, 'large.ts');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.interfaces).toHaveLength(51); // 1 large + 50 small
      expect(result.interfaces[0].properties).toHaveLength(100);
    });

    test('handles deeply nested generic types', async () => {
      const content = `
        interface DeepNested<A, B, C, D> {
          value: Map<string, Array<Promise<Result<A, B> | C> | D>>;
          transform<E>(fn: (x: A) => E): DeepNested<E, B, C, D>;
        }

        type ComplexType<T> = T extends Array<infer U>
          ? U extends Promise<infer V>
            ? V extends Record<string, infer W>
              ? W[]
              : never
            : never
          : never;
      `;

      const result = await analyzer.analyzeContent(content, 'deep.ts');

      expect(result.interfaces).toHaveLength(1);
      expect(result.typeAliases).toHaveLength(1);
      expect(result.interfaces[0].typeParameters).toHaveLength(4);
    });

    test('uses custom analysis options correctly', async () => {
      const content = `
        import type { External } from 'external-lib';

        interface User {
          id: string;
          external: External;
        }

        export type UserRole = 'admin' | 'user';
      `;

      const minimalOptions: TypeAnalysisOptions = {
        includeDependencies: false,
        includeImportsExports: false,
        includeDetailedAnnotations: false,
        includeGenerics: false,
        maxTypeDepth: 1,
        resolveTypeAliases: false
      };

      const result = await analyzer.analyzeContent(content, 'custom.ts', minimalOptions);

      expect(result.typeImports).toHaveLength(0); // Should be empty due to includeImportsExports: false
      expect(result.typeExports).toHaveLength(0); // Should be empty due to includeImportsExports: false
      expect(result.typeDependencies).toHaveLength(0); // Should be empty due to includeDependencies: false
    });
  });
});