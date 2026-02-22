import { describe, it, expect } from 'vitest';
import {
  RepositoryMapSchema,
  CodeSymbolSchema,
  SymbolReferenceSchema,
  ImportEdgeSchema,
  CodeFileSchema,
  SymbolTypeSchema,
} from '../types';

/**
 * Final validation tests to ensure all RepositoryMap types work correctly
 * These tests focus on validating that the schemas correctly parse and validate
 * realistic data structures that would be encountered in real-world usage.
 */
describe('RepositoryMap Final Validation Tests', () => {
  describe('Schema Export Validation', () => {
    it('should export all required schemas', () => {
      expect(SymbolTypeSchema).toBeDefined();
      expect(CodeSymbolSchema).toBeDefined();
      expect(SymbolReferenceSchema).toBeDefined();
      expect(ImportEdgeSchema).toBeDefined();
      expect(CodeFileSchema).toBeDefined();
      expect(RepositoryMapSchema).toBeDefined();
    });

    it('should have correct schema types', () => {
      expect(typeof SymbolTypeSchema.parse).toBe('function');
      expect(typeof CodeSymbolSchema.parse).toBe('function');
      expect(typeof SymbolReferenceSchema.parse).toBe('function');
      expect(typeof ImportEdgeSchema.parse).toBe('function');
      expect(typeof CodeFileSchema.parse).toBe('function');
      expect(typeof RepositoryMapSchema.parse).toBe('function');
    });
  });

  describe('Complete Workflow Validation', () => {
    it('should handle a complete repository analysis workflow', () => {
      // Step 1: Parse symbol types
      const functionType = SymbolTypeSchema.parse('function');
      const classType = SymbolTypeSchema.parse('class');
      const interfaceType = SymbolTypeSchema.parse('interface');

      expect(functionType).toBe('function');
      expect(classType).toBe('class');
      expect(interfaceType).toBe('interface');

      // Step 2: Create symbols with parsed types
      const symbols = [
        CodeSymbolSchema.parse({
          name: 'UserService',
          type: classType,
          filePath: 'src/services/UserService.ts',
          startLine: 1,
          endLine: 50,
          exported: true,
        }),
        CodeSymbolSchema.parse({
          name: 'getUser',
          type: functionType,
          filePath: 'src/services/UserService.ts',
          startLine: 10,
          endLine: 15,
          parent: 'UserService',
        }),
        CodeSymbolSchema.parse({
          name: 'User',
          type: interfaceType,
          filePath: 'src/types/User.ts',
          startLine: 1,
          endLine: 10,
          exported: true,
        }),
      ];

      expect(symbols).toHaveLength(3);
      expect(symbols[0].type).toBe('class');
      expect(symbols[1].parent).toBe('UserService');

      // Step 3: Create import relationships
      const imports = [
        ImportEdgeSchema.parse({
          sourceFile: 'src/services/UserService.ts',
          targetFile: 'src/types/User.ts',
          importedSymbols: ['User'],
          importType: 'named',
        }),
      ];

      expect(imports).toHaveLength(1);
      expect(imports[0].importedSymbols).toContain('User');

      // Step 4: Create symbol references
      const references = [
        SymbolReferenceSchema.parse({
          symbolName: 'User',
          sourceFile: 'src/services/UserService.ts',
          targetFile: 'src/types/User.ts',
          sourceLine: 5,
          sourceColumn: 20,
          symbolType: 'interface',
          referenceType: 'type-annotation',
        }),
      ];

      expect(references).toHaveLength(1);
      expect(references[0].symbolType).toBe('interface');

      // Step 5: Create code files
      const files = [
        CodeFileSchema.parse({
          path: 'src/types/User.ts',
          language: 'typescript',
          symbols: [symbols[2]], // User interface
          exports: [{ name: 'User', isDefault: false }],
        }),
        CodeFileSchema.parse({
          path: 'src/services/UserService.ts',
          language: 'typescript',
          symbols: [symbols[0], symbols[1]], // UserService class and getUser method
          imports: imports,
          exports: [{ name: 'UserService', isDefault: true }],
        }),
      ];

      expect(files).toHaveLength(2);
      expect(files[0].symbols).toHaveLength(1);
      expect(files[1].symbols).toHaveLength(2);

      // Step 6: Create complete repository map
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/my-project',
        name: 'MyProject',
        files: files,
        references: references,
        stats: {
          totalFiles: 2,
          totalSymbols: 3,
          totalReferences: 1,
          languageBreakdown: { typescript: 2 },
          symbolTypeBreakdown: { class: 1, function: 1, interface: 1 },
        },
        version: '1.0.0',
        createdAt: new Date(),
        metadata: {
          analyzer: 'apex-repository-analyzer',
          analysisDate: new Date().toISOString(),
        },
      });

      // Validate final structure
      expect(repositoryMap.rootPath).toBe('/my-project');
      expect(repositoryMap.name).toBe('MyProject');
      expect(repositoryMap.files).toHaveLength(2);
      expect(repositoryMap.references).toHaveLength(1);
      expect(repositoryMap.stats?.totalSymbols).toBe(3);
      expect(repositoryMap.version).toBe('1.0.0');
      expect(repositoryMap.metadata?.analyzer).toBe('apex-repository-analyzer');

      // Validate cross-references work correctly
      const userInterface = repositoryMap.files[0].symbols.find(s => s.name === 'User');
      const userServiceClass = repositoryMap.files[1].symbols.find(s => s.name === 'UserService');
      const getUserMethod = repositoryMap.files[1].symbols.find(s => s.name === 'getUser');

      expect(userInterface?.type).toBe('interface');
      expect(userServiceClass?.type).toBe('class');
      expect(getUserMethod?.type).toBe('function');
      expect(getUserMethod?.parent).toBe('UserService');

      const userReference = repositoryMap.references.find(r => r.symbolName === 'User');
      expect(userReference?.targetFile).toBe('src/types/User.ts');
      expect(userReference?.sourceFile).toBe('src/services/UserService.ts');
    });

    it('should handle minimal repository structures', () => {
      const minimalRepo = RepositoryMapSchema.parse({
        rootPath: '/minimal-project',
      });

      expect(minimalRepo.rootPath).toBe('/minimal-project');
      expect(minimalRepo.files).toEqual([]);
      expect(minimalRepo.references).toEqual([]);
      expect(minimalRepo.errors).toEqual([]);
      expect(minimalRepo.version).toBe('1.0.0');
    });

    it('should handle repositories with only metadata', () => {
      const metadataOnlyRepo = RepositoryMapSchema.parse({
        rootPath: '/metadata-project',
        metadata: {
          buildTool: 'webpack',
          framework: 'react',
          testFramework: 'jest',
          linting: ['eslint', 'prettier'],
          cicd: 'github-actions',
        },
        createdAt: new Date('2024-01-15'),
        version: '2.1.0',
      });

      expect(metadataOnlyRepo.metadata?.buildTool).toBe('webpack');
      expect(metadataOnlyRepo.metadata?.framework).toBe('react');
      expect(metadataOnlyRepo.version).toBe('2.1.0');
      expect(metadataOnlyRepo.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle repositories with mixed valid and invalid files', () => {
      const mixedRepo = RepositoryMapSchema.parse({
        rootPath: '/mixed-project',
        files: [
          // Valid file
          {
            path: 'src/valid.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'validFunction',
                type: 'function',
                filePath: 'src/valid.ts',
                startLine: 1,
                endLine: 5,
              }
            ],
            hasErrors: false,
          },
          // File with errors
          {
            path: 'src/broken.ts',
            language: 'typescript',
            hasErrors: true,
            errors: [
              'Syntax error: Unexpected token at line 10',
              'Type error: Cannot find name "unknownVariable"',
            ],
            symbols: [], // No symbols due to parse errors
          }
        ],
        errors: [
          {
            file: 'src/broken.ts',
            message: 'Failed to parse file due to syntax errors',
            severity: 'error',
          }
        ],
      });

      expect(mixedRepo.files).toHaveLength(2);
      expect(mixedRepo.files[0].hasErrors).toBe(false);
      expect(mixedRepo.files[1].hasErrors).toBe(true);
      expect(mixedRepo.files[1].errors).toHaveLength(2);
      expect(mixedRepo.errors).toHaveLength(1);
      expect(mixedRepo.errors[0].severity).toBe('error');
    });

    it('should validate stats consistency with actual data', () => {
      const repo = RepositoryMapSchema.parse({
        rootPath: '/stats-project',
        files: [
          {
            path: 'file1.ts',
            symbols: [
              { name: 'func1', type: 'function', filePath: 'file1.ts', startLine: 1, endLine: 3 },
              { name: 'Class1', type: 'class', filePath: 'file1.ts', startLine: 5, endLine: 15 },
            ],
          },
          {
            path: 'file2.js',
            symbols: [
              { name: 'func2', type: 'function', filePath: 'file2.js', startLine: 1, endLine: 5 },
            ],
          }
        ],
        references: [
          {
            symbolName: 'func1',
            sourceFile: 'file2.js',
            targetFile: 'file1.ts',
            sourceLine: 3,
            sourceColumn: 10,
          }
        ],
        stats: {
          totalFiles: 2,
          totalSymbols: 3,
          totalReferences: 1,
          languageBreakdown: { typescript: 1, javascript: 1 },
          symbolTypeBreakdown: { function: 2, class: 1 },
        },
      });

      // Verify stats match actual content
      expect(repo.stats?.totalFiles).toBe(repo.files.length);
      expect(repo.stats?.totalSymbols).toBe(
        repo.files.reduce((sum, f) => sum + f.symbols.length, 0)
      );
      expect(repo.stats?.totalReferences).toBe(repo.references.length);

      // Verify language breakdown
      const actualLanguages = repo.files.reduce((langs: Record<string, number>, f) => {
        const lang = f.language || 'unknown';
        langs[lang] = (langs[lang] || 0) + 1;
        return langs;
      }, {});

      expect(repo.stats?.languageBreakdown).toEqual(actualLanguages);
    });
  });

  describe('Serialization and Deserialization', () => {
    it('should serialize and deserialize repository maps correctly', () => {
      const originalRepo = {
        rootPath: '/serialization-test',
        name: 'SerializationTest',
        files: [
          {
            path: 'src/index.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'main',
                type: 'function' as const,
                filePath: 'src/index.ts',
                startLine: 1,
                endLine: 10,
                exported: true,
              }
            ],
            lastModified: new Date('2024-01-15T10:30:00.000Z'),
          }
        ],
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        version: '1.0.0',
      };

      // Parse the data
      const parsedRepo = RepositoryMapSchema.parse(originalRepo);

      // Serialize to JSON
      const serialized = JSON.stringify(parsedRepo);
      expect(typeof serialized).toBe('string');

      // Deserialize from JSON
      const deserialized = JSON.parse(serialized);

      // Re-parse to validate structure
      const reparsedRepo = RepositoryMapSchema.parse({
        ...deserialized,
        // Re-parse dates from strings
        createdAt: new Date(deserialized.createdAt),
        files: deserialized.files.map((f: any) => ({
          ...f,
          lastModified: f.lastModified ? new Date(f.lastModified) : undefined,
        })),
      });

      expect(reparsedRepo.rootPath).toBe(originalRepo.rootPath);
      expect(reparsedRepo.name).toBe(originalRepo.name);
      expect(reparsedRepo.files).toHaveLength(1);
      expect(reparsedRepo.files[0].symbols[0].name).toBe('main');
      expect(reparsedRepo.createdAt).toEqual(originalRepo.createdAt);
      expect(reparsedRepo.files[0].lastModified).toEqual(originalRepo.files[0].lastModified);
    });
  });
});