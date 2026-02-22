/**
 * Acceptance tests for SymbolResolver
 *
 * These tests verify that the SymbolResolver implementation meets all
 * the acceptance criteria defined in the task requirements.
 *
 * Acceptance Criteria:
 * - SymbolResolver class provides findDefinition(symbolName) and findReferences(symbolName) methods
 * - Resolves symbols across files using the RepositoryMap
 * - Unit tests verify cross-file resolution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolResolver } from '../symbol-resolver.js';
import type {
  RepositoryMap,
  CodeFile,
  CodeSymbol,
  SymbolReference,
} from '@apexcli/core';

describe('SymbolResolver Acceptance Tests', () => {
  let testRepositoryMap: RepositoryMap;
  let resolver: SymbolResolver;

  beforeEach(() => {
    // Create a comprehensive test repository with cross-file dependencies
    // This simulates a real project structure with multiple files referencing each other
    const mathUtilsFile: CodeFile = {
      path: 'src/utils/math.ts',
      language: 'typescript',
      symbols: [
        {
          name: 'calculateTotal',
          type: 'function',
          filePath: 'src/utils/math.ts',
          startLine: 5,
          endLine: 12,
          startColumn: 0,
          endColumn: 1,
          exported: true,
          signature: 'function calculateTotal(numbers: number[]): number',
        },
        {
          name: 'MathConstants',
          type: 'enum',
          filePath: 'src/utils/math.ts',
          startLine: 14,
          endLine: 18,
          startColumn: 0,
          endColumn: 1,
          exported: true,
        }
      ],
      lineCount: 20,
      lastModified: new Date(),
    };

    const userModelFile: CodeFile = {
      path: 'src/models/User.ts',
      language: 'typescript',
      symbols: [
        {
          name: 'User',
          type: 'interface',
          filePath: 'src/models/User.ts',
          startLine: 3,
          endLine: 8,
          startColumn: 0,
          endColumn: 1,
          exported: true,
        },
        {
          name: 'UserService',
          type: 'class',
          filePath: 'src/models/User.ts',
          startLine: 10,
          endLine: 25,
          startColumn: 0,
          endColumn: 1,
          exported: true,
        }
      ],
      lineCount: 30,
      lastModified: new Date(),
    };

    const appFile: CodeFile = {
      path: 'src/App.ts',
      language: 'typescript',
      symbols: [
        {
          name: 'App',
          type: 'class',
          filePath: 'src/App.ts',
          startLine: 8,
          endLine: 30,
          startColumn: 0,
          endColumn: 1,
          exported: true,
          isDefault: true,
        }
      ],
      imports: [
        {
          sourceFile: 'src/App.ts',
          targetFile: 'src/utils/math.ts',
          importedSymbols: ['calculateTotal', 'MathConstants'],
          importType: 'named',
        },
        {
          sourceFile: 'src/App.ts',
          targetFile: 'src/models/User.ts',
          importedSymbols: ['User', 'UserService'],
          importType: 'named',
        }
      ],
      lineCount: 35,
      lastModified: new Date(),
    };

    const references: SymbolReference[] = [
      // App.ts uses calculateTotal from math.ts
      {
        symbolName: 'calculateTotal',
        sourceFile: 'src/App.ts',
        sourceLine: 15,
        sourceColumn: 20,
        targetFile: 'src/utils/math.ts',
        targetLine: 5,
        targetColumn: 0,
        referenceType: 'call',
      },
      // App.ts uses MathConstants from math.ts
      {
        symbolName: 'MathConstants',
        sourceFile: 'src/App.ts',
        sourceLine: 18,
        sourceColumn: 25,
        targetFile: 'src/utils/math.ts',
        targetLine: 14,
        targetColumn: 0,
        referenceType: 'read',
      },
      // App.ts uses User interface from User.ts
      {
        symbolName: 'User',
        sourceFile: 'src/App.ts',
        sourceLine: 12,
        sourceColumn: 15,
        targetFile: 'src/models/User.ts',
        targetLine: 3,
        targetColumn: 0,
        referenceType: 'type',
      },
      // App.ts uses UserService from User.ts
      {
        symbolName: 'UserService',
        sourceFile: 'src/App.ts',
        sourceLine: 20,
        sourceColumn: 10,
        targetFile: 'src/models/User.ts',
        targetLine: 10,
        targetColumn: 0,
        referenceType: 'instantiation',
      }
    ];

    testRepositoryMap = {
      rootPath: '/test/project',
      name: 'acceptance-test-project',
      files: [mathUtilsFile, userModelFile, appFile],
      references,
      stats: {
        totalFiles: 3,
        totalSymbols: 5,
        totalReferences: 4,
      },
    };

    resolver = new SymbolResolver(testRepositoryMap);
  });

  describe('Acceptance Criteria: SymbolResolver class provides required methods', () => {
    it('should have findDefinition method that accepts symbolName parameter', () => {
      // Verify the method exists and is callable
      expect(typeof resolver.findDefinition).toBe('function');
      expect(resolver.findDefinition.length).toBeGreaterThanOrEqual(1); // At least 1 parameter

      // Verify it returns expected type
      const result = resolver.findDefinition('calculateTotal');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should have findReferences method that accepts symbolName parameter', () => {
      // Verify the method exists and is callable
      expect(typeof resolver.findReferences).toBe('function');
      expect(resolver.findReferences.length).toBeGreaterThanOrEqual(1); // At least 1 parameter

      // Verify it returns expected type
      const result = resolver.findReferences('calculateTotal');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should provide comprehensive symbol resolution API', () => {
      // Verify additional useful methods are available
      expect(typeof resolver.findSymbolAtLocation).toBe('function');
      expect(typeof resolver.getFileSymbols).toBe('function');
      expect(typeof resolver.getFileExports).toBe('function');
      expect(typeof resolver.hasSymbol).toBe('function');
      expect(typeof resolver.getStats).toBe('function');
      expect(typeof resolver.rebuildIndex).toBe('function');
    });
  });

  describe('Acceptance Criteria: Resolves symbols across files using RepositoryMap', () => {
    it('should resolve function definitions from different files', () => {
      // Find calculateTotal function definition
      const definitions = resolver.findDefinition('calculateTotal');

      expect(definitions.length).toBe(1);
      expect(definitions[0].symbol.name).toBe('calculateTotal');
      expect(definitions[0].symbol.type).toBe('function');
      expect(definitions[0].filePath).toBe('src/utils/math.ts');
      expect(definitions[0].symbol.startLine).toBe(5);
      expect(definitions[0].symbol.exported).toBe(true);
    });

    it('should resolve interface definitions from different files', () => {
      // Find User interface definition
      const definitions = resolver.findDefinition('User');

      expect(definitions.length).toBeGreaterThan(0);
      const userInterface = definitions.find(def => def.symbol.type === 'interface');

      expect(userInterface).toBeDefined();
      expect(userInterface!.symbol.name).toBe('User');
      expect(userInterface!.filePath).toBe('src/models/User.ts');
      expect(userInterface!.symbol.startLine).toBe(3);
    });

    it('should resolve class definitions from different files', () => {
      // Find UserService class definition
      const definitions = resolver.findDefinition('UserService');

      expect(definitions.length).toBeGreaterThan(0);
      const userServiceClass = definitions.find(def => def.symbol.type === 'class');

      expect(userServiceClass).toBeDefined();
      expect(userServiceClass!.symbol.name).toBe('UserService');
      expect(userServiceClass!.filePath).toBe('src/models/User.ts');
      expect(userServiceClass!.symbol.startLine).toBe(10);
    });

    it('should resolve enum definitions from different files', () => {
      // Find MathConstants enum definition
      const definitions = resolver.findDefinition('MathConstants');

      expect(definitions.length).toBe(1);
      expect(definitions[0].symbol.name).toBe('MathConstants');
      expect(definitions[0].symbol.type).toBe('enum');
      expect(definitions[0].filePath).toBe('src/utils/math.ts');
      expect(definitions[0].symbol.startLine).toBe(14);
    });

    it('should use RepositoryMap structure for resolution', () => {
      // Verify that the resolver is using the provided repository map
      const stats = resolver.getStats();

      expect(stats.totalSymbols).toBe(testRepositoryMap.stats?.totalSymbols);
      expect(stats.filesWithSymbols).toBe(testRepositoryMap.files?.length);

      // Verify all files from the repository map are indexed
      testRepositoryMap.files?.forEach(file => {
        const symbols = resolver.getFileSymbols(file.path);
        expect(symbols.length).toBe(file.symbols?.length || 0);
      });
    });
  });

  describe('Acceptance Criteria: Cross-file resolution verification', () => {
    it('should find references across different files', () => {
      // Find references to calculateTotal function
      const references = resolver.findReferences('calculateTotal');

      expect(references.length).toBeGreaterThan(0);

      // Verify the reference comes from a different file than the definition
      const crossFileReference = references.find(ref =>
        ref.reference.sourceFile !== 'src/utils/math.ts' &&
        ref.reference.targetFile === 'src/utils/math.ts'
      );

      expect(crossFileReference).toBeDefined();
      expect(crossFileReference!.reference.sourceFile).toBe('src/App.ts');
      expect(crossFileReference!.reference.symbolName).toBe('calculateTotal');
      expect(crossFileReference!.reference.referenceType).toBe('call');
    });

    it('should find interface references across different files', () => {
      // Find references to User interface
      const references = resolver.findReferences('User');

      expect(references.length).toBeGreaterThan(0);

      // Verify cross-file reference
      const crossFileReference = references.find(ref =>
        ref.reference.sourceFile === 'src/App.ts' &&
        ref.reference.targetFile === 'src/models/User.ts'
      );

      expect(crossFileReference).toBeDefined();
      expect(crossFileReference!.reference.symbolName).toBe('User');
      expect(crossFileReference!.reference.referenceType).toBe('type');
    });

    it('should find class instantiation references across files', () => {
      // Find references to UserService class
      const references = resolver.findReferences('UserService');

      expect(references.length).toBeGreaterThan(0);

      // Verify cross-file instantiation reference
      const instantiationReference = references.find(ref =>
        ref.reference.sourceFile === 'src/App.ts' &&
        ref.reference.referenceType === 'instantiation'
      );

      expect(instantiationReference).toBeDefined();
      expect(instantiationReference!.reference.symbolName).toBe('UserService');
      expect(instantiationReference!.reference.targetFile).toBe('src/models/User.ts');
    });

    it('should find enum references across files', () => {
      // Find references to MathConstants enum
      const references = resolver.findReferences('MathConstants');

      expect(references.length).toBeGreaterThan(0);

      // Verify cross-file reference
      const enumReference = references.find(ref =>
        ref.reference.sourceFile === 'src/App.ts' &&
        ref.reference.targetFile === 'src/utils/math.ts'
      );

      expect(enumReference).toBeDefined();
      expect(enumReference!.reference.symbolName).toBe('MathConstants');
      expect(enumReference!.reference.referenceType).toBe('read');
    });

    it('should correctly resolve import-based references', () => {
      // App.ts imports symbols from both math.ts and User.ts
      const appImportReferences = resolver.findReferences('calculateTotal');

      // Should find both the explicit reference and the import reference
      const importReference = appImportReferences.find(ref =>
        ref.reference.referenceType === 'import'
      );

      expect(importReference).toBeDefined();
      expect(importReference!.reference.sourceFile).toBe('src/App.ts');
      expect(importReference!.reference.targetFile).toBe('src/utils/math.ts');
    });

    it('should track bidirectional relationships correctly', () => {
      // Test that we can find what files depend on math.ts
      const mathUtilsFile = 'src/utils/math.ts';
      const symbolsInMathFile = resolver.getFileSymbols(mathUtilsFile);

      expect(symbolsInMathFile.length).toBe(2); // calculateTotal and MathConstants

      // For each symbol in math.ts, verify we can find its references
      symbolsInMathFile.forEach(symbol => {
        const references = resolver.findReferences(symbol.name);
        const externalReferences = references.filter(ref =>
          ref.reference.sourceFile !== mathUtilsFile
        );

        if (symbol.exported) {
          // Exported symbols should have references from other files
          expect(externalReferences.length).toBeGreaterThan(0);
        }
      });
    });

    it('should maintain referential integrity across the repository', () => {
      // Verify that all references in the repository map point to valid definitions
      testRepositoryMap.references?.forEach(reference => {
        const definitions = resolver.findDefinition(reference.symbolName);

        expect(definitions.length).toBeGreaterThan(0);

        // At least one definition should be in the target file
        const targetDefinition = definitions.find(def =>
          def.filePath === reference.targetFile
        );

        expect(targetDefinition).toBeDefined();
      });
    });

    it('should provide complete cross-file dependency mapping', () => {
      // Test that we can build a complete dependency graph
      const dependencyMap = new Map<string, Set<string>>();

      testRepositoryMap.files?.forEach(file => {
        const dependencies = new Set<string>();

        // Find all files this file depends on via imports
        file.imports?.forEach(imp => {
          dependencies.add(imp.targetFile);
        });

        // Find all files this file references via symbol usage
        const fileReferences = testRepositoryMap.references?.filter(ref =>
          ref.sourceFile === file.path
        );

        fileReferences?.forEach(ref => {
          if (ref.targetFile) {
            dependencies.add(ref.targetFile);
          }
        });

        if (dependencies.size > 0) {
          dependencyMap.set(file.path, dependencies);
        }
      });

      // Verify App.ts depends on both utils and models
      const appDependencies = dependencyMap.get('src/App.ts');
      expect(appDependencies).toBeDefined();
      expect(appDependencies!.has('src/utils/math.ts')).toBe(true);
      expect(appDependencies!.has('src/models/User.ts')).toBe(true);

      // Verify math.ts and User.ts have no dependencies (leaf files)
      expect(dependencyMap.has('src/utils/math.ts')).toBe(false);
      expect(dependencyMap.has('src/models/User.ts')).toBe(false);
    });
  });

  describe('Additional Quality Assurance', () => {
    it('should handle non-existent symbols gracefully', () => {
      const definitions = resolver.findDefinition('NonExistentSymbol');
      const references = resolver.findReferences('NonExistentSymbol');

      expect(definitions).toEqual([]);
      expect(references).toEqual([]);
    });

    it('should provide consistent results across multiple calls', () => {
      // Multiple calls should return the same results
      const definitions1 = resolver.findDefinition('calculateTotal');
      const definitions2 = resolver.findDefinition('calculateTotal');
      const references1 = resolver.findReferences('calculateTotal');
      const references2 = resolver.findReferences('calculateTotal');

      expect(definitions1).toEqual(definitions2);
      expect(references1).toEqual(references2);
    });

    it('should maintain performance with cross-file operations', () => {
      // Cross-file operations should complete quickly
      const startTime = performance.now();

      testRepositoryMap.files?.forEach(file => {
        file.symbols?.forEach(symbol => {
          resolver.findDefinition(symbol.name);
          resolver.findReferences(symbol.name);
        });
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete all operations within reasonable time
      expect(totalTime).toBeLessThan(100); // 100ms for this small test set
    });
  });
});