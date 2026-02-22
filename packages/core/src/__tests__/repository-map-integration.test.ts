import { describe, it, expect } from 'vitest';
import {
  RepositoryMap,
  RepositoryMapSchema,
  CodeSymbol,
  SymbolReference,
  ImportEdge,
  CodeFile,
} from '../types';

describe('RepositoryMap Integration Tests', () => {
  describe('Type Consistency and Relationships', () => {
    it('should maintain referential integrity between files, symbols, and references', () => {
      const repoMap: RepositoryMap = {
        rootPath: '/project',
        files: [
          {
            path: 'src/math.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'add',
                type: 'function',
                filePath: 'src/math.ts',
                startLine: 1,
                endLine: 3,
                exported: true,
              },
              {
                name: 'subtract',
                type: 'function',
                filePath: 'src/math.ts',
                startLine: 5,
                endLine: 7,
                exported: true,
              }
            ],
            exports: [
              { name: 'add', isDefault: false },
              { name: 'subtract', isDefault: false },
            ]
          },
          {
            path: 'src/calculator.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'Calculator',
                type: 'class',
                filePath: 'src/calculator.ts',
                startLine: 3,
                endLine: 15,
                exported: true,
                isDefault: true,
              }
            ],
            imports: [
              {
                sourceFile: 'src/calculator.ts',
                targetFile: 'src/math.ts',
                importedSymbols: ['add', 'subtract'],
                importType: 'named',
              }
            ],
            exports: [
              { name: 'Calculator', isDefault: true }
            ]
          }
        ],
        references: [
          {
            symbolName: 'add',
            sourceFile: 'src/calculator.ts',
            targetFile: 'src/math.ts',
            sourceLine: 8,
            sourceColumn: 15,
            symbolType: 'function',
            referenceType: 'call',
          },
          {
            symbolName: 'subtract',
            sourceFile: 'src/calculator.ts',
            targetFile: 'src/math.ts',
            sourceLine: 12,
            sourceColumn: 15,
            symbolType: 'function',
            referenceType: 'call',
          }
        ],
        stats: {
          totalFiles: 2,
          totalSymbols: 3,
          totalReferences: 2,
          languageBreakdown: { typescript: 2 },
          symbolTypeBreakdown: { function: 2, class: 1 },
        }
      };

      // Validate the entire structure
      const validated = RepositoryMapSchema.parse(repoMap);

      // Test referential integrity
      const mathFile = validated.files.find(f => f.path === 'src/math.ts')!;
      const calculatorFile = validated.files.find(f => f.path === 'src/calculator.ts')!;

      expect(mathFile).toBeDefined();
      expect(calculatorFile).toBeDefined();

      // Verify exported symbols exist in the file
      const exportedSymbols = mathFile.symbols.filter(s => s.exported);
      expect(exportedSymbols.map(s => s.name)).toEqual(['add', 'subtract']);

      // Verify imports match exported symbols
      const importedSymbols = calculatorFile.imports[0].importedSymbols!;
      expect(importedSymbols).toEqual(['add', 'subtract']);

      // Verify references point to correct symbols and files
      for (const ref of validated.references) {
        expect(importedSymbols).toContain(ref.symbolName);
        expect(ref.sourceFile).toBe('src/calculator.ts');
        expect(ref.targetFile).toBe('src/math.ts');
      }

      // Verify stats match actual content
      expect(validated.stats!.totalFiles).toBe(validated.files.length);
      expect(validated.stats!.totalSymbols).toBe(
        validated.files.reduce((sum, f) => sum + f.symbols.length, 0)
      );
      expect(validated.stats!.totalReferences).toBe(validated.references.length);
    });

    it('should handle complex inheritance and dependency chains', () => {
      const repoMap: RepositoryMap = {
        rootPath: '/complex-project',
        files: [
          // Base class
          {
            path: 'src/base/Animal.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'Animal',
                type: 'class',
                filePath: 'src/base/Animal.ts',
                startLine: 1,
                endLine: 15,
                exported: true,
                children: ['move', 'speak'],
              }
            ]
          },
          // Derived class 1
          {
            path: 'src/mammals/Dog.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'Dog',
                type: 'class',
                filePath: 'src/mammals/Dog.ts',
                startLine: 3,
                endLine: 20,
                exported: true,
                parent: 'Animal',
                children: ['bark', 'wagTail'],
              }
            ],
            imports: [
              {
                sourceFile: 'src/mammals/Dog.ts',
                targetFile: 'src/base/Animal.ts',
                importedSymbols: ['Animal'],
                importType: 'named',
              }
            ]
          },
          // Derived class 2
          {
            path: 'src/birds/Eagle.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'Eagle',
                type: 'class',
                filePath: 'src/birds/Eagle.ts',
                startLine: 3,
                endLine: 25,
                exported: true,
                parent: 'Animal',
                children: ['fly', 'hunt'],
              }
            ],
            imports: [
              {
                sourceFile: 'src/birds/Eagle.ts',
                targetFile: 'src/base/Animal.ts',
                importedSymbols: ['Animal'],
                importType: 'named',
              }
            ]
          },
          // Zoo that uses both
          {
            path: 'src/Zoo.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'Zoo',
                type: 'class',
                filePath: 'src/Zoo.ts',
                startLine: 5,
                endLine: 30,
                exported: true,
                isDefault: true,
              }
            ],
            imports: [
              {
                sourceFile: 'src/Zoo.ts',
                targetFile: 'src/mammals/Dog.ts',
                importedSymbols: ['Dog'],
                importType: 'named',
              },
              {
                sourceFile: 'src/Zoo.ts',
                targetFile: 'src/birds/Eagle.ts',
                importedSymbols: ['Eagle'],
                importType: 'named',
              }
            ]
          }
        ],
        references: [
          // Dog references Animal
          {
            symbolName: 'Animal',
            sourceFile: 'src/mammals/Dog.ts',
            targetFile: 'src/base/Animal.ts',
            sourceLine: 1,
            sourceColumn: 20,
            symbolType: 'class',
            referenceType: 'extends',
          },
          // Eagle references Animal
          {
            symbolName: 'Animal',
            sourceFile: 'src/birds/Eagle.ts',
            targetFile: 'src/base/Animal.ts',
            sourceLine: 1,
            sourceColumn: 20,
            symbolType: 'class',
            referenceType: 'extends',
          },
          // Zoo references Dog
          {
            symbolName: 'Dog',
            sourceFile: 'src/Zoo.ts',
            targetFile: 'src/mammals/Dog.ts',
            sourceLine: 10,
            sourceColumn: 30,
            symbolType: 'class',
            referenceType: 'instantiation',
          },
          // Zoo references Eagle
          {
            symbolName: 'Eagle',
            sourceFile: 'src/Zoo.ts',
            targetFile: 'src/birds/Eagle.ts',
            sourceLine: 15,
            sourceColumn: 25,
            symbolType: 'class',
            referenceType: 'instantiation',
          }
        ]
      };

      const validated = RepositoryMapSchema.parse(repoMap);

      // Verify inheritance relationships
      const dogClass = validated.files
        .find(f => f.path === 'src/mammals/Dog.ts')!
        .symbols.find(s => s.name === 'Dog')!;
      const eagleClass = validated.files
        .find(f => f.path === 'src/birds/Eagle.ts')!
        .symbols.find(s => s.name === 'Eagle')!;

      expect(dogClass.parent).toBe('Animal');
      expect(eagleClass.parent).toBe('Animal');

      // Verify dependency chain through references
      const animalReferences = validated.references.filter(r => r.symbolName === 'Animal');
      expect(animalReferences).toHaveLength(2);

      const derivedClasses = animalReferences.map(r => r.sourceFile);
      expect(derivedClasses).toContain('src/mammals/Dog.ts');
      expect(derivedClasses).toContain('src/birds/Eagle.ts');
    });

    it('should handle circular dependencies gracefully', () => {
      const repoMap: RepositoryMap = {
        rootPath: '/circular-project',
        files: [
          {
            path: 'src/A.ts',
            symbols: [
              { name: 'ClassA', type: 'class', filePath: 'src/A.ts', startLine: 1, endLine: 10 }
            ],
            imports: [
              { sourceFile: 'src/A.ts', targetFile: 'src/B.ts', importedSymbols: ['ClassB'] }
            ]
          },
          {
            path: 'src/B.ts',
            symbols: [
              { name: 'ClassB', type: 'class', filePath: 'src/B.ts', startLine: 1, endLine: 10 }
            ],
            imports: [
              { sourceFile: 'src/B.ts', targetFile: 'src/A.ts', importedSymbols: ['ClassA'] }
            ]
          }
        ],
        references: [
          {
            symbolName: 'ClassB',
            sourceFile: 'src/A.ts',
            targetFile: 'src/B.ts',
            sourceLine: 5,
            sourceColumn: 10,
          },
          {
            symbolName: 'ClassA',
            sourceFile: 'src/B.ts',
            targetFile: 'src/A.ts',
            sourceLine: 5,
            sourceColumn: 10,
          }
        ]
      };

      // Should parse without errors
      const validated = RepositoryMapSchema.parse(repoMap);
      expect(validated.files).toHaveLength(2);
      expect(validated.references).toHaveLength(2);

      // Verify circular references exist
      const aToB = validated.references.find(r =>
        r.sourceFile === 'src/A.ts' && r.targetFile === 'src/B.ts');
      const bToA = validated.references.find(r =>
        r.sourceFile === 'src/B.ts' && r.targetFile === 'src/A.ts');

      expect(aToB).toBeDefined();
      expect(bToA).toBeDefined();
    });
  });

  describe('Multi-Language Repository Scenarios', () => {
    it('should handle polyglot repositories with multiple languages', () => {
      const repoMap: RepositoryMap = {
        rootPath: '/polyglot-project',
        files: [
          // TypeScript API
          {
            path: 'api/src/server.ts',
            language: 'typescript',
            symbols: [
              { name: 'Server', type: 'class', filePath: 'api/src/server.ts', startLine: 1, endLine: 50 },
              { name: 'startServer', type: 'function', filePath: 'api/src/server.ts', startLine: 52, endLine: 60 }
            ]
          },
          // Python data processing
          {
            path: 'data/processor.py',
            language: 'python',
            symbols: [
              { name: 'DataProcessor', type: 'class', filePath: 'data/processor.py', startLine: 1, endLine: 100 },
              { name: 'process_data', type: 'function', filePath: 'data/processor.py', startLine: 102, endLine: 120 }
            ]
          },
          // Go microservice
          {
            path: 'services/auth/main.go',
            language: 'go',
            symbols: [
              { name: 'AuthService', type: 'type', filePath: 'services/auth/main.go', startLine: 10, endLine: 15 },
              { name: 'main', type: 'function', filePath: 'services/auth/main.go', startLine: 20, endLine: 50 }
            ]
          },
          // Rust performance module
          {
            path: 'lib/performance/src/lib.rs',
            language: 'rust',
            symbols: [
              { name: 'PerformanceTracker', type: 'struct', filePath: 'lib/performance/src/lib.rs', startLine: 5, endLine: 20 },
              { name: 'track_performance', type: 'function', filePath: 'lib/performance/src/lib.rs', startLine: 25, endLine: 40 }
            ]
          }
        ],
        stats: {
          totalFiles: 4,
          totalSymbols: 8,
          totalReferences: 0,
          languageBreakdown: {
            typescript: 1,
            python: 1,
            go: 1,
            rust: 1,
          },
          symbolTypeBreakdown: {
            class: 2,
            function: 4,
            type: 1,
            struct: 1,
          }
        }
      };

      const validated = RepositoryMapSchema.parse(repoMap);

      // Verify language distribution
      expect(Object.keys(validated.stats!.languageBreakdown)).toHaveLength(4);
      expect(validated.stats!.languageBreakdown.typescript).toBe(1);
      expect(validated.stats!.languageBreakdown.python).toBe(1);
      expect(validated.stats!.languageBreakdown.go).toBe(1);
      expect(validated.stats!.languageBreakdown.rust).toBe(1);

      // Verify different symbol types from different languages
      const tsSymbols = validated.files.find(f => f.language === 'typescript')!.symbols;
      const pySymbols = validated.files.find(f => f.language === 'python')!.symbols;
      const goSymbols = validated.files.find(f => f.language === 'go')!.symbols;
      const rustSymbols = validated.files.find(f => f.language === 'rust')!.symbols;

      expect(tsSymbols.some(s => s.type === 'class')).toBe(true);
      expect(pySymbols.some(s => s.type === 'class')).toBe(true);
      expect(goSymbols.some(s => s.type === 'type')).toBe(true);
      expect(rustSymbols.some(s => s.type === 'struct')).toBe(true);
    });
  });

  describe('Large-Scale Repository Scenarios', () => {
    it('should handle enterprise-scale repositories with many files and symbols', () => {
      // Generate a large repository structure
      const files: CodeFile[] = [];
      const references: SymbolReference[] = [];

      // Generate core modules
      for (let i = 0; i < 50; i++) {
        files.push({
          path: `src/core/module${i}.ts`,
          language: 'typescript',
          symbols: Array.from({ length: 10 }, (_, j) => ({
            name: `CoreFunction${i}_${j}`,
            type: 'function',
            filePath: `src/core/module${i}.ts`,
            startLine: j * 5 + 1,
            endLine: j * 5 + 5,
            exported: true,
          })),
        });
      }

      // Generate feature modules that depend on core modules
      for (let i = 0; i < 100; i++) {
        const coreModuleIndex = i % 50;
        files.push({
          path: `src/features/feature${i}.ts`,
          language: 'typescript',
          symbols: Array.from({ length: 5 }, (_, j) => ({
            name: `FeatureClass${i}_${j}`,
            type: 'class',
            filePath: `src/features/feature${i}.ts`,
            startLine: j * 10 + 1,
            endLine: j * 10 + 10,
          })),
          imports: [
            {
              sourceFile: `src/features/feature${i}.ts`,
              targetFile: `src/core/module${coreModuleIndex}.ts`,
              importedSymbols: [`CoreFunction${coreModuleIndex}_0`],
            }
          ],
        });

        // Add reference
        references.push({
          symbolName: `CoreFunction${coreModuleIndex}_0`,
          sourceFile: `src/features/feature${i}.ts`,
          targetFile: `src/core/module${coreModuleIndex}.ts`,
          sourceLine: 15,
          sourceColumn: 10,
          symbolType: 'function',
        });
      }

      const largeRepoMap: RepositoryMap = {
        rootPath: '/enterprise-project',
        files,
        references,
        stats: {
          totalFiles: 150,
          totalSymbols: 1000, // 50 * 10 + 100 * 5
          totalReferences: 100,
          languageBreakdown: { typescript: 150 },
          symbolTypeBreakdown: { function: 500, class: 500 },
        }
      };

      const startTime = Date.now();
      const validated = RepositoryMapSchema.parse(largeRepoMap);
      const validationTime = Date.now() - startTime;

      // Verify structure
      expect(validated.files).toHaveLength(150);
      expect(validated.references).toHaveLength(100);

      // Verify performance (should validate large repo quickly)
      expect(validationTime).toBeLessThan(1000); // Less than 1 second

      // Verify a sample of the relationships
      const firstFeature = validated.files.find(f => f.path === 'src/features/feature0.ts')!;
      expect(firstFeature.imports).toHaveLength(1);
      expect(firstFeature.imports[0].targetFile).toBe('src/core/module0.ts');

      const firstReference = validated.references.find(r =>
        r.sourceFile === 'src/features/feature0.ts')!;
      expect(firstReference.symbolName).toBe('CoreFunction0_0');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle repositories with errors gracefully', () => {
      const repoMapWithErrors: RepositoryMap = {
        rootPath: '/project-with-errors',
        files: [
          {
            path: 'src/broken.ts',
            language: 'typescript',
            hasErrors: true,
            errors: [
              'Syntax error at line 10: Unexpected token',
              'Type error: Property "nonexistent" does not exist'
            ],
            symbols: [], // No symbols due to parsing errors
          },
          {
            path: 'src/working.ts',
            language: 'typescript',
            hasErrors: false,
            symbols: [
              {
                name: 'workingFunction',
                type: 'function',
                filePath: 'src/working.ts',
                startLine: 1,
                endLine: 5,
              }
            ]
          }
        ],
        errors: [
          'Failed to parse src/broken.ts',
          'Missing dependency in src/missing-import.ts'
        ]
      };

      const validated = RepositoryMapSchema.parse(repoMapWithErrors);

      expect(validated.errors).toHaveLength(2);
      expect(validated.files[0].hasErrors).toBe(true);
      expect(validated.files[0].errors).toHaveLength(2);
      expect(validated.files[1].hasErrors).toBe(false);
    });
  });

  describe('Versioning and Git Integration', () => {
    it('should handle version control information', () => {
      const versionedRepoMap: RepositoryMap = {
        rootPath: '/versioned-project',
        version: '2.1.0',
        commitHash: 'abc123def456789',
        branch: 'feature/new-architecture',
        files: [
          {
            path: 'src/index.ts',
            lastModified: new Date('2024-01-15T10:30:00Z'),
            contentHash: 'file-hash-123',
          }
        ],
        createdAt: new Date('2024-01-15T10:30:00Z'),
        metadata: {
          gitAuthor: 'developer@example.com',
          buildNumber: '1234',
          ciPipeline: 'github-actions',
        }
      };

      const validated = RepositoryMapSchema.parse(versionedRepoMap);

      expect(validated.version).toBe('2.1.0');
      expect(validated.commitHash).toBe('abc123def456789');
      expect(validated.branch).toBe('feature/new-architecture');
      expect(validated.createdAt).toBeInstanceOf(Date);
      expect(validated.files[0].lastModified).toBeInstanceOf(Date);
      expect(validated.metadata!.gitAuthor).toBe('developer@example.com');
    });
  });
});