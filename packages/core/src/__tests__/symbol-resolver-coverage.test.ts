import { describe, it, expect } from 'vitest';
import { SymbolResolver } from '../symbol-resolver';
import { RepositoryMapSchema } from '../types';

/**
 * Coverage verification tests for SymbolResolver
 * Ensures all methods, error conditions, and edge cases are properly tested
 */
describe('SymbolResolver Coverage Verification', () => {
  describe('Method Coverage', () => {
    it('should have all required public methods', () => {
      const emptyRepo = RepositoryMapSchema.parse({ rootPath: '/test' });
      const resolver = new SymbolResolver(emptyRepo);

      // Core required methods from acceptance criteria
      expect(resolver).toHaveProperty('findDefinition');
      expect(resolver).toHaveProperty('findReferences');

      // Additional utility methods
      expect(resolver).toHaveProperty('findSymbolsInFile');
      expect(resolver).toHaveProperty('findReferencesFromFile');
      expect(resolver).toHaveProperty('findReferencesToFile');
      expect(resolver).toHaveProperty('findSymbolsByType');
      expect(resolver).toHaveProperty('getStatistics');

      // All methods should be functions
      expect(typeof resolver.findDefinition).toBe('function');
      expect(typeof resolver.findReferences).toBe('function');
      expect(typeof resolver.findSymbolsInFile).toBe('function');
      expect(typeof resolver.findReferencesFromFile).toBe('function');
      expect(typeof resolver.findReferencesToFile).toBe('function');
      expect(typeof resolver.findSymbolsByType).toBe('function');
      expect(typeof resolver.getStatistics).toBe('function');
    });

    it('should handle constructor with valid RepositoryMap', () => {
      const validRepo = RepositoryMapSchema.parse({
        rootPath: '/valid/project',
        files: [
          {
            path: 'test.ts',
            symbols: [
              { name: 'test', type: 'function', filePath: 'test.ts', startLine: 1, endLine: 1 }
            ]
          }
        ]
      });

      expect(() => new SymbolResolver(validRepo)).not.toThrow();
      const resolver = new SymbolResolver(validRepo);
      expect(resolver).toBeInstanceOf(SymbolResolver);
    });
  });

  describe('Return Type Coverage', () => {
    it('should return correct types for findDefinition', () => {
      const repo = RepositoryMapSchema.parse({
        rootPath: '/test',
        files: [
          {
            path: 'test.ts',
            symbols: [
              { name: 'testSymbol', type: 'function', filePath: 'test.ts', startLine: 1, endLine: 1 }
            ]
          }
        ]
      });
      const resolver = new SymbolResolver(repo);

      // Found symbol should return SymbolDefinition
      const found = resolver.findDefinition('testSymbol');
      expect(found).toHaveProperty('symbol');
      expect(found).toHaveProperty('filePath');
      expect(found).toHaveProperty('line');
      expect(found).toHaveProperty('column');
      expect(found!.symbol).toHaveProperty('name');
      expect(found!.symbol).toHaveProperty('type');

      // Not found should return null
      const notFound = resolver.findDefinition('nonExistent');
      expect(notFound).toBeNull();
    });

    it('should return correct types for findReferences', () => {
      const repo = RepositoryMapSchema.parse({
        rootPath: '/test',
        files: [
          { path: 'test.ts', symbols: [{ name: 'test', type: 'function', filePath: 'test.ts', startLine: 1, endLine: 1 }] }
        ],
        references: [
          { symbolName: 'test', sourceFile: 'test.ts', sourceLine: 5, targetFile: 'test.ts' }
        ]
      });
      const resolver = new SymbolResolver(repo);

      // Found references should return SymbolReferencesResult
      const found = resolver.findReferences('test');
      expect(found).toHaveProperty('symbol');
      expect(found).toHaveProperty('references');
      expect(Array.isArray(found!.references)).toBe(true);

      if (found!.references.length > 0) {
        expect(found!.references[0]).toHaveProperty('reference');
        expect(found!.references[0]).toHaveProperty('filePath');
        expect(found!.references[0]).toHaveProperty('line');
        expect(found!.references[0]).toHaveProperty('column');
      }

      // Not found should return null
      const notFound = resolver.findReferences('nonExistent');
      expect(notFound).toBeNull();
    });

    it('should return correct types for utility methods', () => {
      const repo = RepositoryMapSchema.parse({
        rootPath: '/test',
        files: [
          {
            path: 'test.ts',
            symbols: [{ name: 'test', type: 'function', filePath: 'test.ts', startLine: 1, endLine: 1 }]
          }
        ],
        references: [
          { symbolName: 'test', sourceFile: 'test.ts', sourceLine: 5, targetFile: 'test.ts' }
        ]
      });
      const resolver = new SymbolResolver(repo);

      // findSymbolsInFile should return array of SymbolDefinition
      const symbols = resolver.findSymbolsInFile('test.ts');
      expect(Array.isArray(symbols)).toBe(true);
      if (symbols.length > 0) {
        expect(symbols[0]).toHaveProperty('symbol');
        expect(symbols[0]).toHaveProperty('filePath');
        expect(symbols[0]).toHaveProperty('line');
      }

      // findReferencesFromFile should return array of reference objects
      const fromRefs = resolver.findReferencesFromFile('test.ts');
      expect(Array.isArray(fromRefs)).toBe(true);

      // findReferencesToFile should return array of reference objects
      const toRefs = resolver.findReferencesToFile('test.ts');
      expect(Array.isArray(toRefs)).toBe(true);

      // findSymbolsByType should return array of SymbolDefinition
      const byType = resolver.findSymbolsByType('function');
      expect(Array.isArray(byType)).toBe(true);

      // getStatistics should return statistics object
      const stats = resolver.getStatistics();
      expect(stats).toHaveProperty('totalSymbols');
      expect(stats).toHaveProperty('totalReferences');
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('symbolsByType');
      expect(stats).toHaveProperty('filesWithSymbols');
      expect(stats).toHaveProperty('filesWithReferences');
    });
  });

  describe('Error Handling Coverage', () => {
    it('should handle invalid input gracefully', () => {
      const repo = RepositoryMapSchema.parse({ rootPath: '/test' });
      const resolver = new SymbolResolver(repo);

      // Should not throw errors for invalid inputs
      expect(() => resolver.findDefinition('')).not.toThrow();
      expect(() => resolver.findReferences('')).not.toThrow();
      expect(() => resolver.findSymbolsInFile('')).not.toThrow();
      expect(() => resolver.findReferencesFromFile('')).not.toThrow();
      expect(() => resolver.findReferencesToFile('')).not.toThrow();
      expect(() => resolver.findSymbolsByType('')).not.toThrow();
      expect(() => resolver.getStatistics()).not.toThrow();
    });

    it('should handle edge case inputs', () => {
      const repo = RepositoryMapSchema.parse({ rootPath: '/test' });
      const resolver = new SymbolResolver(repo);

      // Very long strings
      const longString = 'a'.repeat(10000);
      expect(() => resolver.findDefinition(longString)).not.toThrow();
      expect(() => resolver.findReferences(longString)).not.toThrow();

      // Special characters
      const specialChars = '!@#$%^&*()[]{}|\\:";\'<>?,.';
      expect(() => resolver.findDefinition(specialChars)).not.toThrow();
      expect(() => resolver.findSymbolsByType(specialChars)).not.toThrow();

      // Unicode characters
      const unicodeString = '测试函数名称';
      expect(() => resolver.findDefinition(unicodeString)).not.toThrow();
    });
  });

  describe('Boundary Condition Coverage', () => {
    it('should handle repository with maximum complexity', () => {
      // Test with complex nested structures
      const complexRepo = RepositoryMapSchema.parse({
        rootPath: '/complex',
        files: Array.from({ length: 10 }, (_, i) => ({
          path: `module${i}.ts`,
          language: 'typescript',
          symbols: Array.from({ length: 5 }, (_, j) => ({
            name: `symbol${i}_${j}`,
            type: j % 2 === 0 ? 'function' : 'class',
            filePath: `module${i}.ts`,
            startLine: j + 1,
            endLine: j + 2,
            startColumn: 0,
            endColumn: 10,
            exported: true,
            parent: j > 0 ? `symbol${i}_0` : undefined,
            signature: `${j % 2 === 0 ? 'function' : 'class'} symbol${i}_${j}`,
            documentation: `Documentation for symbol${i}_${j}`,
            modifiers: j % 3 === 0 ? ['static'] : []
          }))
        })),
        references: Array.from({ length: 25 }, (_, i) => ({
          symbolName: `symbol${i % 10}_${(i % 5)}`,
          symbolType: i % 2 === 0 ? 'function' : 'class',
          sourceFile: `module${(i + 1) % 10}.ts`,
          sourceLine: (i % 10) + 1,
          sourceColumn: i % 50,
          targetFile: `module${i % 10}.ts`,
          targetLine: (i % 5) + 1,
          targetColumn: 0,
          referenceType: i % 3 === 0 ? 'call' : i % 3 === 1 ? 'type' : 'import',
          isDynamic: i % 7 === 0,
          confidence: Math.min(1, (i % 10) / 10 + 0.5)
        }))
      });

      const resolver = new SymbolResolver(complexRepo);

      // Should handle all operations efficiently
      expect(() => {
        const stats = resolver.getStatistics();
        expect(stats.totalSymbols).toBe(50);
        expect(stats.totalReferences).toBe(25);
        expect(stats.totalFiles).toBe(10);
      }).not.toThrow();

      // Should find symbols across the complex structure
      const allFunctions = resolver.findSymbolsByType('function');
      const allClasses = resolver.findSymbolsByType('class');
      expect(allFunctions.length).toBe(25);
      expect(allClasses.length).toBe(25);

      // Should handle references to symbols with modifiers and metadata
      const symbol = resolver.findDefinition('symbol0_0');
      expect(symbol).not.toBeNull();
      expect(symbol!.symbol).toHaveProperty('modifiers');
      expect(symbol!.symbol).toHaveProperty('documentation');
    });

    it('should handle repository with empty and minimal data', () => {
      // Completely empty repository
      const emptyRepo = RepositoryMapSchema.parse({
        rootPath: '/empty'
      });
      const emptyResolver = new SymbolResolver(emptyRepo);

      const stats = emptyResolver.getStatistics();
      expect(stats.totalSymbols).toBe(0);
      expect(stats.totalReferences).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.filesWithSymbols).toBe(0);
      expect(stats.filesWithReferences).toBe(0);

      // Repository with files but no symbols
      const noSymbolsRepo = RepositoryMapSchema.parse({
        rootPath: '/nosymbols',
        files: [
          { path: 'empty1.ts', language: 'typescript' },
          { path: 'empty2.ts', language: 'typescript' }
        ]
      });
      const noSymbolsResolver = new SymbolResolver(noSymbolsRepo);

      const noSymbolsStats = noSymbolsResolver.getStatistics();
      expect(noSymbolsStats.totalFiles).toBe(2);
      expect(noSymbolsStats.totalSymbols).toBe(0);
      expect(noSymbolsStats.filesWithSymbols).toBe(0);
    });
  });

  describe('Cross-file Resolution Coverage', () => {
    it('should verify all cross-file scenarios are covered', () => {
      const crossFileRepo = RepositoryMapSchema.parse({
        rootPath: '/crossfile',
        files: [
          {
            path: 'types.ts',
            symbols: [
              { name: 'IType', type: 'interface', filePath: 'types.ts', startLine: 1, endLine: 5 },
              { name: 'EType', type: 'enum', filePath: 'types.ts', startLine: 7, endLine: 12 }
            ]
          },
          {
            path: 'impl.ts',
            symbols: [
              { name: 'Implementation', type: 'class', filePath: 'impl.ts', startLine: 1, endLine: 20 },
              { name: 'create', type: 'method', filePath: 'impl.ts', startLine: 5, endLine: 10, parent: 'Implementation' }
            ]
          },
          {
            path: 'utils.ts',
            symbols: [
              { name: 'helper', type: 'function', filePath: 'utils.ts', startLine: 1, endLine: 5 },
              { name: 'CONSTANT', type: 'constant', filePath: 'utils.ts', startLine: 7, endLine: 7 }
            ]
          }
        ],
        references: [
          // Interface usage
          {
            symbolName: 'IType',
            sourceFile: 'impl.ts',
            sourceLine: 1,
            targetFile: 'types.ts',
            referenceType: 'type'
          },
          // Enum usage
          {
            symbolName: 'EType',
            sourceFile: 'impl.ts',
            sourceLine: 8,
            targetFile: 'types.ts',
            referenceType: 'type'
          },
          // Function call
          {
            symbolName: 'helper',
            sourceFile: 'impl.ts',
            sourceLine: 12,
            targetFile: 'utils.ts',
            referenceType: 'call'
          },
          // Constant reference
          {
            symbolName: 'CONSTANT',
            sourceFile: 'impl.ts',
            sourceLine: 15,
            targetFile: 'utils.ts',
            referenceType: 'reference'
          }
        ]
      });

      const resolver = new SymbolResolver(crossFileRepo);

      // Verify each type of cross-file resolution
      const types = ['interface', 'enum', 'class', 'method', 'function', 'constant'];
      types.forEach(type => {
        const symbols = resolver.findSymbolsByType(type);
        expect(symbols.length).toBeGreaterThan(0);
      });

      // Verify cross-file dependencies are tracked correctly
      const implDependencies = resolver.findReferencesFromFile('impl.ts');
      expect(implDependencies).toHaveLength(4);

      const typesDependents = resolver.findReferencesToFile('types.ts');
      expect(typesDependents).toHaveLength(2);

      const utilsDependents = resolver.findReferencesToFile('utils.ts');
      expect(utilsDependents).toHaveLength(2);
    });
  });

  describe('Performance Coverage', () => {
    it('should verify performance characteristics are maintained', () => {
      // This test ensures performance tests exist and basic performance is acceptable
      const mediumRepo = RepositoryMapSchema.parse({
        rootPath: '/performance',
        files: Array.from({ length: 50 }, (_, i) => ({
          path: `file${i}.ts`,
          symbols: Array.from({ length: 10 }, (_, j) => ({
            name: `symbol${i}_${j}`,
            type: 'function',
            filePath: `file${i}.ts`,
            startLine: j + 1,
            endLine: j + 1
          }))
        })),
        references: Array.from({ length: 100 }, (_, i) => ({
          symbolName: `symbol${i % 50}_${i % 10}`,
          sourceFile: `file${(i + 1) % 50}.ts`,
          sourceLine: 1,
          targetFile: `file${i % 50}.ts`
        }))
      });

      const resolver = new SymbolResolver(mediumRepo);

      // Basic operations should complete quickly
      const start = Date.now();

      const definition = resolver.findDefinition('symbol25_5');
      const references = resolver.findReferences('symbol25_5');
      const stats = resolver.getStatistics();

      const elapsed = Date.now() - start;

      expect(definition).not.toBeNull();
      expect(references).not.toBeNull();
      expect(stats.totalSymbols).toBe(500);
      expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});