import { describe, it, expect } from 'vitest';
import { SymbolResolver, SymbolDefinition, SymbolReferencesResult } from '../symbol-resolver';
import { RepositoryMapSchema } from '../types';

/**
 * Export Functionality Verification for SymbolResolver
 * Tests that verify the SymbolResolver can be properly imported and used
 * as specified in the acceptance criteria
 */
describe('SymbolResolver Export Functionality Verification', () => {
  describe('Module Exports', () => {
    it('should export SymbolResolver class', () => {
      expect(SymbolResolver).toBeDefined();
      expect(typeof SymbolResolver).toBe('function');
      expect(SymbolResolver.prototype).toBeDefined();
    });

    it('should export SymbolDefinition interface type', () => {
      // TypeScript interface types are erased at runtime, but we can verify
      // they work correctly by creating objects that match the interface
      const symbolDefinition: SymbolDefinition = {
        symbol: {
          name: 'testSymbol',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1,
          startColumn: 0,
          endColumn: 10,
          exported: true
        },
        filePath: 'test.ts',
        line: 1,
        column: 0
      };

      expect(symbolDefinition).toHaveProperty('symbol');
      expect(symbolDefinition).toHaveProperty('filePath');
      expect(symbolDefinition).toHaveProperty('line');
      expect(symbolDefinition).toHaveProperty('column');
    });

    it('should export SymbolReferencesResult interface type', () => {
      // Verify SymbolReferencesResult interface works correctly
      const symbolReferencesResult: SymbolReferencesResult = {
        symbol: {
          name: 'testSymbol',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1,
          startColumn: 0,
          endColumn: 10,
          exported: true
        },
        references: [
          {
            reference: {
              symbolName: 'testSymbol',
              sourceFile: 'caller.ts',
              sourceLine: 5,
              targetFile: 'test.ts'
            },
            filePath: 'caller.ts',
            line: 5,
            column: 10
          }
        ]
      };

      expect(symbolReferencesResult).toHaveProperty('symbol');
      expect(symbolReferencesResult).toHaveProperty('references');
      expect(Array.isArray(symbolReferencesResult.references)).toBe(true);
    });
  });

  describe('Class Instantiation and Usage', () => {
    it('should allow proper instantiation with RepositoryMap', () => {
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'example.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'exampleFunction',
                type: 'function',
                filePath: 'example.ts',
                startLine: 1,
                endLine: 5,
                exported: true
              }
            ]
          }
        ]
      });

      // Should instantiate without errors
      const resolver = new SymbolResolver(repositoryMap);
      expect(resolver).toBeInstanceOf(SymbolResolver);
      expect(resolver).toHaveProperty('findDefinition');
      expect(resolver).toHaveProperty('findReferences');
    });

    it('should provide working findDefinition method', () => {
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'math.ts',
            symbols: [
              {
                name: 'add',
                type: 'function',
                filePath: 'math.ts',
                startLine: 1,
                endLine: 3,
                signature: 'function add(a: number, b: number): number',
                exported: true
              },
              {
                name: 'PI',
                type: 'constant',
                filePath: 'math.ts',
                startLine: 5,
                endLine: 5,
                exported: true
              }
            ]
          }
        ]
      });

      const resolver = new SymbolResolver(repositoryMap);

      // Test findDefinition functionality
      const addDefinition = resolver.findDefinition('add');
      expect(addDefinition).not.toBeNull();
      expect(addDefinition!.symbol.name).toBe('add');
      expect(addDefinition!.symbol.type).toBe('function');
      expect(addDefinition!.filePath).toBe('math.ts');
      expect(addDefinition!.line).toBe(1);

      const piDefinition = resolver.findDefinition('PI');
      expect(piDefinition).not.toBeNull();
      expect(piDefinition!.symbol.name).toBe('PI');
      expect(piDefinition!.symbol.type).toBe('constant');

      // Non-existent symbol should return null
      expect(resolver.findDefinition('nonExistent')).toBeNull();
    });

    it('should provide working findReferences method', () => {
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/test/project',
        files: [
          {
            path: 'math.ts',
            symbols: [
              {
                name: 'multiply',
                type: 'function',
                filePath: 'math.ts',
                startLine: 1,
                endLine: 3,
                exported: true
              }
            ]
          },
          {
            path: 'calculator.ts',
            symbols: [
              {
                name: 'Calculator',
                type: 'class',
                filePath: 'calculator.ts',
                startLine: 1,
                endLine: 10,
                exported: true
              }
            ]
          }
        ],
        references: [
          {
            symbolName: 'multiply',
            sourceFile: 'calculator.ts',
            sourceLine: 5,
            targetFile: 'math.ts',
            referenceType: 'call'
          }
        ]
      });

      const resolver = new SymbolResolver(repositoryMap);

      // Test findReferences functionality
      const multiplyReferences = resolver.findReferences('multiply');
      expect(multiplyReferences).not.toBeNull();
      expect(multiplyReferences!.symbol.name).toBe('multiply');
      expect(multiplyReferences!.references).toHaveLength(1);

      const reference = multiplyReferences!.references[0];
      expect(reference.filePath).toBe('calculator.ts');
      expect(reference.line).toBe(5);
      expect(reference.reference.symbolName).toBe('multiply');
      expect(reference.reference.targetFile).toBe('math.ts');

      // Symbol with no references should return empty array
      const calculatorReferences = resolver.findReferences('Calculator');
      expect(calculatorReferences).not.toBeNull();
      expect(calculatorReferences!.references).toHaveLength(0);

      // Non-existent symbol should return null
      expect(resolver.findReferences('nonExistent')).toBeNull();
    });
  });

  describe('Cross-file Resolution Verification', () => {
    it('should demonstrate cross-file symbol resolution as per acceptance criteria', () => {
      // Create a repository with symbols across multiple files
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/cross-file/project',
        files: [
          // Define types in one file
          {
            path: 'types/interfaces.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'ApiResponse',
                type: 'interface',
                filePath: 'types/interfaces.ts',
                startLine: 1,
                endLine: 5,
                exported: true
              },
              {
                name: 'HttpStatus',
                type: 'enum',
                filePath: 'types/interfaces.ts',
                startLine: 7,
                endLine: 12,
                exported: true
              }
            ]
          },
          // Use types in service file
          {
            path: 'services/api.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'ApiService',
                type: 'class',
                filePath: 'services/api.ts',
                startLine: 3,
                endLine: 20,
                exported: true
              },
              {
                name: 'fetchData',
                type: 'method',
                filePath: 'services/api.ts',
                startLine: 5,
                endLine: 10,
                parent: 'ApiService'
              }
            ]
          },
          // Use service in controller
          {
            path: 'controllers/main.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'MainController',
                type: 'class',
                filePath: 'controllers/main.ts',
                startLine: 1,
                endLine: 15,
                exported: true
              }
            ]
          }
        ],
        references: [
          // Service references types
          {
            symbolName: 'ApiResponse',
            sourceFile: 'services/api.ts',
            sourceLine: 5,
            targetFile: 'types/interfaces.ts',
            referenceType: 'type'
          },
          {
            symbolName: 'HttpStatus',
            sourceFile: 'services/api.ts',
            sourceLine: 8,
            targetFile: 'types/interfaces.ts',
            referenceType: 'type'
          },
          // Controller references service
          {
            symbolName: 'ApiService',
            sourceFile: 'controllers/main.ts',
            sourceLine: 5,
            targetFile: 'services/api.ts',
            referenceType: 'instantiation'
          },
          // Controller references service method
          {
            symbolName: 'fetchData',
            sourceFile: 'controllers/main.ts',
            sourceLine: 8,
            targetFile: 'services/api.ts',
            referenceType: 'call'
          }
        ]
      });

      const resolver = new SymbolResolver(repositoryMap);

      // Verify cross-file definition resolution
      const apiResponseDef = resolver.findDefinition('ApiResponse');
      expect(apiResponseDef).not.toBeNull();
      expect(apiResponseDef!.filePath).toBe('types/interfaces.ts');

      const apiServiceDef = resolver.findDefinition('ApiService');
      expect(apiServiceDef).not.toBeNull();
      expect(apiServiceDef!.filePath).toBe('services/api.ts');

      // Verify cross-file reference resolution
      const apiResponseRefs = resolver.findReferences('ApiResponse');
      expect(apiResponseRefs).not.toBeNull();
      expect(apiResponseRefs!.references).toHaveLength(1);
      expect(apiResponseRefs!.references[0].filePath).toBe('services/api.ts');
      expect(apiResponseRefs!.references[0].reference.targetFile).toBe('types/interfaces.ts');

      const apiServiceRefs = resolver.findReferences('ApiService');
      expect(apiServiceRefs).not.toBeNull();
      expect(apiServiceRefs!.references).toHaveLength(1);
      expect(apiServiceRefs!.references[0].filePath).toBe('controllers/main.ts');
      expect(apiServiceRefs!.references[0].reference.targetFile).toBe('services/api.ts');

      // Verify method cross-file resolution
      const fetchDataRefs = resolver.findReferences('fetchData');
      expect(fetchDataRefs).not.toBeNull();
      expect(fetchDataRefs!.references).toHaveLength(1);
      expect(fetchDataRefs!.references[0].filePath).toBe('controllers/main.ts');
      expect(fetchDataRefs!.references[0].reference.targetFile).toBe('services/api.ts');
    });

    it('should handle complex cross-file dependency chains', () => {
      // Test a chain: models -> services -> controllers
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/dependency-chain',
        files: [
          {
            path: 'models/User.ts',
            symbols: [{ name: 'User', type: 'class', filePath: 'models/User.ts', startLine: 1, endLine: 10, exported: true }]
          },
          {
            path: 'services/UserService.ts',
            symbols: [{ name: 'UserService', type: 'class', filePath: 'services/UserService.ts', startLine: 1, endLine: 20, exported: true }]
          },
          {
            path: 'controllers/UserController.ts',
            symbols: [{ name: 'UserController', type: 'class', filePath: 'controllers/UserController.ts', startLine: 1, endLine: 15, exported: true }]
          }
        ],
        references: [
          {
            symbolName: 'User',
            sourceFile: 'services/UserService.ts',
            sourceLine: 5,
            targetFile: 'models/User.ts',
            referenceType: 'type'
          },
          {
            symbolName: 'UserService',
            sourceFile: 'controllers/UserController.ts',
            sourceLine: 3,
            targetFile: 'services/UserService.ts',
            referenceType: 'instantiation'
          }
        ]
      });

      const resolver = new SymbolResolver(repositoryMap);

      // Verify the entire chain can be traced
      // 1. Controller depends on Service
      const controllerDeps = resolver.findReferencesFromFile('controllers/UserController.ts');
      expect(controllerDeps).toHaveLength(1);
      expect(controllerDeps[0].reference.targetFile).toBe('services/UserService.ts');

      // 2. Service depends on Model
      const serviceDeps = resolver.findReferencesFromFile('services/UserService.ts');
      expect(serviceDeps).toHaveLength(1);
      expect(serviceDeps[0].reference.targetFile).toBe('models/User.ts');

      // 3. Model has dependents through the chain
      const modelDependents = resolver.findReferencesToFile('models/User.ts');
      expect(modelDependents).toHaveLength(1);
      expect(modelDependents[0].filePath).toBe('services/UserService.ts');

      const serviceDependents = resolver.findReferencesToFile('services/UserService.ts');
      expect(serviceDependents).toHaveLength(1);
      expect(serviceDependents[0].filePath).toBe('controllers/UserController.ts');
    });
  });

  describe('Integration with Project Types', () => {
    it('should work correctly with all RepositoryMap structure elements', () => {
      const repositoryMap = RepositoryMapSchema.parse({
        rootPath: '/integration/project',
        name: 'Integration Test Project',
        files: [
          {
            path: 'src/main.ts',
            language: 'typescript',
            size: 1024,
            lastModified: new Date().toISOString(),
            symbols: [
              {
                name: 'main',
                type: 'function',
                filePath: 'src/main.ts',
                startLine: 1,
                endLine: 10,
                startColumn: 0,
                endColumn: 1,
                exported: true,
                signature: 'export function main(): void',
                documentation: 'Main entry point',
                parent: undefined,
                isAsync: false,
                isDefault: false,
                modifiers: ['export'],
                metadata: { framework: 'node' }
              }
            ],
            imports: [
              {
                sourceFile: 'src/main.ts',
                targetFile: 'src/utils.ts',
                importedSymbols: ['helper'],
                isTypeOnly: false,
                importType: 'named'
              }
            ],
            exports: [
              {
                name: 'main',
                isDefault: false
              }
            ]
          },
          {
            path: 'src/utils.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'helper',
                type: 'function',
                filePath: 'src/utils.ts',
                startLine: 1,
                endLine: 3,
                exported: true
              }
            ]
          }
        ],
        references: [
          {
            symbolName: 'helper',
            symbolType: 'function',
            sourceFile: 'src/main.ts',
            sourceLine: 5,
            sourceColumn: 10,
            targetFile: 'src/utils.ts',
            targetLine: 1,
            targetColumn: 0,
            referenceType: 'call',
            isDynamic: false,
            confidence: 1.0
          }
        ],
        stats: {
          totalFiles: 2,
          totalSymbols: 2,
          totalReferences: 1,
          totalLines: 13,
          languageBreakdown: { typescript: 2 },
          symbolTypeBreakdown: { function: 2 }
        },
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        gitInfo: {
          branch: 'main',
          commit: 'abc123',
          isDirty: false
        }
      });

      const resolver = new SymbolResolver(repositoryMap);

      // Verify all features work with complete repository structure
      const mainDef = resolver.findDefinition('main');
      expect(mainDef).not.toBeNull();
      expect(mainDef!.symbol).toHaveProperty('metadata');
      expect(mainDef!.symbol).toHaveProperty('modifiers');
      expect(mainDef!.symbol).toHaveProperty('documentation');

      const helperRefs = resolver.findReferences('helper');
      expect(helperRefs).not.toBeNull();
      expect(helperRefs!.references[0].reference).toHaveProperty('confidence');
      expect(helperRefs!.references[0].reference).toHaveProperty('isDynamic');

      const stats = resolver.getStatistics();
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSymbols).toBe(2);
      expect(stats.totalReferences).toBe(1);
    });
  });
});