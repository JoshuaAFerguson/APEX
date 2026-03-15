/**
 * Tests for SymbolResolver
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolResolver, FindOptions } from '../symbol-resolver.js';
import type {
  RepositoryMap,
  CodeFile,
  CodeSymbol,
  SymbolReference,
  SymbolType,
} from '@apexcli/core/types';

// Helper function to create test symbols
function createTestSymbol(
  name: string,
  type: SymbolType,
  filePath: string,
  startLine: number,
  endLine: number,
  exported: boolean = false
): CodeSymbol {
  return {
    name,
    type,
    filePath,
    startLine,
    endLine,
    startColumn: 0,
    endColumn: name.length,
    exported,
  };
}

// Helper function to create test files
function createTestFile(
  path: string,
  symbols: CodeSymbol[],
  imports: Array<{
    targetFile: string;
    importedSymbols: string[];
  }> = [],
  exports: Array<{
    name: string;
    originalName?: string;
    fromFile?: string;
    isDefault?: boolean;
  }> = []
): CodeFile {
  return {
    path,
    language: 'typescript',
    symbols,
    imports: imports.map(imp => ({
      sourceFile: path,
      targetFile: imp.targetFile,
      importedSymbols: imp.importedSymbols,
      importType: 'named' as const,
    })),
    exports,
    lineCount: Math.max(...symbols.map(s => s.endLine), 10),
    lastModified: new Date('2024-01-01'),
  };
}

// Helper function to create test references
function createTestReference(
  symbolName: string,
  sourceFile: string,
  sourceLine: number,
  targetFile?: string,
  referenceType: string = 'call'
): SymbolReference {
  return {
    symbolName,
    sourceFile,
    sourceLine,
    sourceColumn: 0,
    targetFile,
    referenceType: referenceType as any,
  };
}

describe('SymbolResolver', () => {
  let testRepoMap: RepositoryMap;
  let resolver: SymbolResolver;

  beforeEach(() => {
    // Create a test repository map with various symbols and cross-file references
    const userClassSymbol = createTestSymbol('User', 'class', 'src/models/User.ts', 5, 20, true);
    const userServiceSymbol = createTestSymbol('UserService', 'class', 'src/services/UserService.ts', 3, 50, true);
    const calculateTotalSymbol = createTestSymbol('calculateTotal', 'function', 'src/utils/math.ts', 10, 15, true);
    const privateHelperSymbol = createTestSymbol('_privateHelper', 'function', 'src/utils/math.ts', 17, 20, false);
    const configConstSymbol = createTestSymbol('CONFIG', 'constant', 'src/config/index.ts', 1, 5, true);

    const userFile = createTestFile('src/models/User.ts', [userClassSymbol]);
    const userServiceFile = createTestFile(
      'src/services/UserService.ts',
      [userServiceSymbol],
      [{ targetFile: 'src/models/User.ts', importedSymbols: ['User'] }]
    );
    const mathFile = createTestFile('src/utils/math.ts', [calculateTotalSymbol, privateHelperSymbol]);
    const configFile = createTestFile('src/config/index.ts', [configConstSymbol]);

    // File with re-exports
    const indexFile = createTestFile(
      'src/index.ts',
      [],
      [],
      [
        { name: 'User', fromFile: 'src/models/User.ts' },
        { name: 'UserService', fromFile: 'src/services/UserService.ts' }
      ]
    );

    const references: SymbolReference[] = [
      createTestReference('User', 'src/services/UserService.ts', 5, 'src/models/User.ts', 'instantiation'),
      createTestReference('calculateTotal', 'src/components/Cart.tsx', 25, 'src/utils/math.ts', 'call'),
      createTestReference('CONFIG', 'src/services/UserService.ts', 8, 'src/config/index.ts', 'read'),
    ];

    testRepoMap = {
      rootPath: '/test/project',
      name: 'test-project',
      files: [userFile, userServiceFile, mathFile, configFile, indexFile],
      references,
      stats: {
        totalFiles: 5,
        totalSymbols: 5,
        totalReferences: 3,
      },
    };

    resolver = new SymbolResolver(testRepoMap);
  });

  describe('constructor and index building', () => {
    it('should build indexes correctly', () => {
      expect(resolver.hasSymbol('User')).toBe(true);
      expect(resolver.hasSymbol('UserService')).toBe(true);
      expect(resolver.hasSymbol('calculateTotal')).toBe(true);
      expect(resolver.hasSymbol('_privateHelper')).toBe(true);
      expect(resolver.hasSymbol('CONFIG')).toBe(true);
      expect(resolver.hasSymbol('NonExistentSymbol')).toBe(false);
    });

    it('should provide correct statistics', () => {
      const stats = resolver.getStats();
      expect(stats.totalSymbols).toBe(5);
      expect(stats.uniqueNames).toBeGreaterThan(0);
      expect(stats.filesWithSymbols).toBe(4); // index.ts has no symbols
      expect(stats.indexBuildTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.byType.class).toBe(2);
      expect(stats.byType.function).toBe(2);
      expect(stats.byType.constant).toBe(1);
    });
  });

  describe('findDefinition', () => {
    it('should find exact matches', () => {
      const definitions = resolver.findDefinition('User');
      expect(definitions).toHaveLength(2); // Original + re-export
      expect(definitions[0].symbol.name).toBe('User');
      expect(definitions[0].symbol.type).toBe('class');
      expect(definitions[0].confidence).toBe(1.0);
    });

    it('should handle case-insensitive search', () => {
      const definitions = resolver.findDefinition('user', { caseSensitive: false });
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].symbol.name).toBe('User');
    });

    it('should handle partial matches', () => {
      const definitions = resolver.findDefinition('Service', { exactMatch: false });
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].symbol.name).toBe('UserService');
    });

    it('should filter by symbol type', () => {
      const definitions = resolver.findDefinition('User', { symbolType: 'function' });
      expect(definitions).toHaveLength(0);

      const classDefinitions = resolver.findDefinition('User', { symbolType: 'class' });
      expect(classDefinitions.length).toBeGreaterThan(0);
      expect(classDefinitions[0].symbol.type).toBe('class');
    });

    it('should filter by multiple symbol types', () => {
      const definitions = resolver.findDefinition('calculateTotal', { symbolType: ['function', 'class'] });
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].symbol.type).toBe('function');
    });

    it('should filter by exported status', () => {
      const exportedDefinitions = resolver.findDefinition('_privateHelper', { exportedOnly: true });
      expect(exportedDefinitions).toHaveLength(0);

      const allDefinitions = resolver.findDefinition('_privateHelper', { exportedOnly: false });
      expect(allDefinitions.length).toBeGreaterThan(0);
    });

    it('should filter by file path', () => {
      const definitions = resolver.findDefinition('calculateTotal', { filePath: 'src/utils/*' });
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].filePath).toContain('src/utils/');

      const noMatches = resolver.findDefinition('calculateTotal', { filePath: 'src/models/*' });
      expect(noMatches).toHaveLength(0);
    });

    it('should exclude private symbols when includePrivate is false', () => {
      const definitions = resolver.findDefinition('_privateHelper', { includePrivate: false });
      expect(definitions).toHaveLength(0);

      const allDefinitions = resolver.findDefinition('_privateHelper', { includePrivate: true });
      expect(allDefinitions.length).toBeGreaterThan(0);
    });

    it('should respect limit option', () => {
      const definitions = resolver.findDefinition('User', { limit: 1 });
      expect(definitions).toHaveLength(1);
    });

    it('should return empty array for non-existent symbols', () => {
      const definitions = resolver.findDefinition('NonExistentSymbol');
      expect(definitions).toHaveLength(0);
    });

    it('should handle re-exports correctly', () => {
      const definitions = resolver.findDefinition('User');
      const reExportDef = definitions.find(def => def.isReExport);
      expect(reExportDef).toBeDefined();
      expect(reExportDef?.originalDefinition).toBeDefined();
      expect(reExportDef?.originalDefinition?.filePath).toBe('src/models/User.ts');
    });
  });

  describe('findReferences', () => {
    it('should find direct references', () => {
      const references = resolver.findReferences('User');
      expect(references.length).toBeGreaterThan(0);

      const instantiationRef = references.find(ref => ref.reference.referenceType === 'instantiation');
      expect(instantiationRef).toBeDefined();
      expect(instantiationRef?.reference.sourceFile).toBe('src/services/UserService.ts');
    });

    it('should find import references', () => {
      const references = resolver.findReferences('User');
      const importRef = references.find(ref => ref.reference.referenceType === 'import');
      expect(importRef).toBeDefined();
      expect(importRef?.reference.sourceFile).toBe('src/services/UserService.ts');
    });

    it('should filter by file path', () => {
      const references = resolver.findReferences('User', { filePath: 'src/services/*' });
      expect(references.length).toBeGreaterThan(0);

      references.forEach(ref => {
        expect(ref.reference.sourceFile).toContain('src/services/');
      });
    });

    it('should respect limit option', () => {
      const references = resolver.findReferences('User', { limit: 1 });
      expect(references).toHaveLength(1);
    });

    it('should return empty array for non-existent symbols', () => {
      const references = resolver.findReferences('NonExistentSymbol');
      expect(references).toHaveLength(0);
    });

    it('should resolve references to definitions', () => {
      const references = resolver.findReferences('calculateTotal');
      expect(references.length).toBeGreaterThan(0);

      const callRef = references.find(ref => ref.reference.referenceType === 'call');
      expect(callRef?.definition).toBeDefined();
      expect(callRef?.definition?.symbol.name).toBe('calculateTotal');
    });
  });

  describe('findSymbolAtLocation', () => {
    it('should find symbol at specific location', () => {
      const symbol = resolver.findSymbolAtLocation('src/models/User.ts', 10);
      expect(symbol).toBeDefined();
      expect(symbol?.name).toBe('User');
    });

    it('should return undefined for locations outside symbols', () => {
      const symbol = resolver.findSymbolAtLocation('src/models/User.ts', 1);
      expect(symbol).toBeUndefined();
    });

    it('should return undefined for non-existent files', () => {
      const symbol = resolver.findSymbolAtLocation('non-existent.ts', 1);
      expect(symbol).toBeUndefined();
    });

    it('should handle column-specific lookups', () => {
      const symbol = resolver.findSymbolAtLocation('src/models/User.ts', 5, 2);
      expect(symbol).toBeDefined();
      expect(symbol?.name).toBe('User');
    });
  });

  describe('getFileSymbols', () => {
    it('should return all symbols in a file', () => {
      const symbols = resolver.getFileSymbols('src/utils/math.ts');
      expect(symbols).toHaveLength(2);
      expect(symbols.map(s => s.name).sort()).toEqual(['_privateHelper', 'calculateTotal']);
    });

    it('should return empty array for files with no symbols', () => {
      const symbols = resolver.getFileSymbols('src/index.ts');
      expect(symbols).toHaveLength(0);
    });

    it('should return empty array for non-existent files', () => {
      const symbols = resolver.getFileSymbols('non-existent.ts');
      expect(symbols).toHaveLength(0);
    });
  });

  describe('getFileExports', () => {
    it('should return exported symbols from a file', () => {
      const exports = resolver.getFileExports('src/models/User.ts');
      expect(exports.size).toBe(1);
      expect(exports.has('User')).toBe(true);
    });

    it('should return empty map for files with no exports', () => {
      const exports = resolver.getFileExports('src/index.ts');
      expect(exports.size).toBe(0);
    });

    it('should exclude private symbols from exports', () => {
      const exports = resolver.getFileExports('src/utils/math.ts');
      expect(exports.has('calculateTotal')).toBe(true);
      expect(exports.has('_privateHelper')).toBe(false);
    });
  });

  describe('hasSymbol', () => {
    it('should return true for existing symbols', () => {
      expect(resolver.hasSymbol('User')).toBe(true);
      expect(resolver.hasSymbol('calculateTotal')).toBe(true);
    });

    it('should return false for non-existent symbols', () => {
      expect(resolver.hasSymbol('NonExistentSymbol')).toBe(false);
    });

    it('should respect search options', () => {
      expect(resolver.hasSymbol('User', { symbolType: 'class' })).toBe(true);
      expect(resolver.hasSymbol('User', { symbolType: 'function' })).toBe(false);
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild indexes when repository map changes', () => {
      // Initially User exists
      expect(resolver.hasSymbol('User')).toBe(true);
      expect(resolver.hasSymbol('NewSymbol')).toBe(false);

      // Add a new symbol to the repository map
      const newSymbol = createTestSymbol('NewSymbol', 'function', 'src/new.ts', 1, 5, true);
      const newFile = createTestFile('src/new.ts', [newSymbol]);
      testRepoMap.files!.push(newFile);

      // Before rebuild, new symbol shouldn't be found
      expect(resolver.hasSymbol('NewSymbol')).toBe(false);

      // Rebuild and now it should be found
      resolver.rebuildIndex();
      expect(resolver.hasSymbol('NewSymbol')).toBe(true);

      // Stats should be updated
      const stats = resolver.getStats();
      expect(stats.totalSymbols).toBe(6); // 5 original + 1 new
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty repository map', () => {
      const emptyRepoMap: RepositoryMap = {
        rootPath: '/empty',
        files: [],
        references: [],
        stats: { totalFiles: 0, totalSymbols: 0, totalReferences: 0 },
      };

      const emptyResolver = new SymbolResolver(emptyRepoMap);
      expect(emptyResolver.hasSymbol('AnySymbol')).toBe(false);
      expect(emptyResolver.findDefinition('AnySymbol')).toHaveLength(0);
      expect(emptyResolver.findReferences('AnySymbol')).toHaveLength(0);

      const stats = emptyResolver.getStats();
      expect(stats.totalSymbols).toBe(0);
      expect(stats.uniqueNames).toBe(0);
    });

    it('should handle malformed file paths in filters', () => {
      // Should not crash with invalid patterns
      const definitions = resolver.findDefinition('User', { filePath: '[invalid-regex' });
      expect(Array.isArray(definitions)).toBe(true);
    });

    it('should handle symbols with missing file references', () => {
      // Create a reference to a non-existent file
      const badReference: SymbolReference = {
        symbolName: 'User',
        sourceFile: 'non-existent-file.ts',
        sourceLine: 1,
        sourceColumn: 0,
        referenceType: 'call',
      };

      testRepoMap.references!.push(badReference);
      resolver.rebuildIndex();

      // Should still work and not include the bad reference
      const references = resolver.findReferences('User');
      const badRef = references.find(ref => ref.reference.sourceFile === 'non-existent-file.ts');
      expect(badRef).toBeUndefined();
    });

    it('should handle circular re-exports gracefully', () => {
      // This is a complex case that would need special handling in a real implementation
      // For now, we just verify it doesn't crash
      const circularFile1 = createTestFile(
        'src/circular1.ts',
        [],
        [],
        [{ name: 'Symbol', fromFile: 'src/circular2.ts' }]
      );
      const circularFile2 = createTestFile(
        'src/circular2.ts',
        [],
        [],
        [{ name: 'Symbol', fromFile: 'src/circular1.ts' }]
      );

      testRepoMap.files!.push(circularFile1, circularFile2);

      // Should not crash when rebuilding
      expect(() => resolver.rebuildIndex()).not.toThrow();
    });
  });

  describe('confidence scoring', () => {
    it('should assign higher confidence to exact matches', () => {
      const definitions = resolver.findDefinition('User');
      const exactMatch = definitions.find(def => def.symbol.name === 'User');
      expect(exactMatch?.confidence).toBe(1.0);
    });

    it('should assign lower confidence to partial matches', () => {
      const definitions = resolver.findDefinition('Service', { exactMatch: false });
      const partialMatch = definitions.find(def => def.symbol.name === 'UserService');
      expect(partialMatch?.confidence).toBeLessThan(1.0);
      expect(partialMatch?.confidence).toBeGreaterThan(0);
    });

    it('should boost confidence for exported symbols', () => {
      const exportedDef = resolver.findDefinition('calculateTotal')[0];
      const privateDef = resolver.findDefinition('_privateHelper')[0];

      // Exported symbol should have higher confidence (assuming same name match)
      expect(exportedDef.confidence).toBeGreaterThan(privateDef.confidence);
    });
  });
});