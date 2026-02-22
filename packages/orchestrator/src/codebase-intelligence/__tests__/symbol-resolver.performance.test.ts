/**
 * Performance tests for SymbolResolver
 *
 * These tests verify that SymbolResolver performs well with large codebases
 * and provides reasonable response times for common operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolResolver, FindOptions } from '../symbol-resolver.js';
import type { RepositoryMap, CodeFile, CodeSymbol, SymbolReference } from '@apexcli/core';

// Helper to generate large test repository maps
function generateLargeRepositoryMap(
  fileCount: number,
  symbolsPerFile: number,
  referencesPerFile: number
): RepositoryMap {
  const files: CodeFile[] = [];
  const references: SymbolReference[] = [];

  for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
    const fileName = `src/module${fileIndex}.ts`;
    const symbols: CodeSymbol[] = [];

    // Generate symbols for this file
    for (let symbolIndex = 0; symbolIndex < symbolsPerFile; symbolIndex++) {
      const symbolName = `Symbol${fileIndex}_${symbolIndex}`;
      const symbolTypes = ['class', 'function', 'interface', 'enum', 'constant'] as const;
      const symbolType = symbolTypes[symbolIndex % symbolTypes.length];

      symbols.push({
        name: symbolName,
        type: symbolType,
        filePath: fileName,
        startLine: symbolIndex * 10 + 1,
        endLine: symbolIndex * 10 + 5,
        startColumn: 0,
        endColumn: symbolName.length,
        exported: symbolIndex % 3 === 0, // Every third symbol is exported
      });
    }

    files.push({
      path: fileName,
      language: 'typescript',
      symbols,
      lineCount: symbolsPerFile * 10,
      lastModified: new Date(),
    });

    // Generate references from this file to other files
    for (let refIndex = 0; refIndex < referencesPerFile && fileIndex > 0; refIndex++) {
      const targetFileIndex = Math.max(0, fileIndex - 1 - (refIndex % 3));
      const targetFileName = `src/module${targetFileIndex}.ts`;
      const targetSymbolName = `Symbol${targetFileIndex}_${refIndex % symbolsPerFile}`;

      references.push({
        symbolName: targetSymbolName,
        sourceFile: fileName,
        sourceLine: refIndex * 5 + 10,
        sourceColumn: 10,
        targetFile: targetFileName,
        referenceType: 'call',
      });
    }
  }

  return {
    rootPath: '/test/large-project',
    name: 'large-test-project',
    files,
    references,
    stats: {
      totalFiles: fileCount,
      totalSymbols: fileCount * symbolsPerFile,
      totalReferences: references.length,
    },
  };
}

describe('SymbolResolver Performance', () => {
  describe('Index Building Performance', () => {
    it('should build indexes for small codebase quickly', () => {
      const repoMap = generateLargeRepositoryMap(10, 10, 5);

      const startTime = performance.now();
      const resolver = new SymbolResolver(repoMap);
      const endTime = performance.now();

      const buildTime = endTime - startTime;
      const stats = resolver.getStats();

      expect(stats.totalSymbols).toBe(100);
      expect(stats.filesWithSymbols).toBe(10);
      expect(buildTime).toBeLessThan(100); // Should build quickly for small codebase

      console.log(`Small codebase (10 files, 100 symbols): ${buildTime.toFixed(2)}ms`);
    });

    it('should build indexes for medium codebase efficiently', () => {
      const repoMap = generateLargeRepositoryMap(100, 20, 10);

      const startTime = performance.now();
      const resolver = new SymbolResolver(repoMap);
      const endTime = performance.now();

      const buildTime = endTime - startTime;
      const stats = resolver.getStats();

      expect(stats.totalSymbols).toBe(2000);
      expect(stats.filesWithSymbols).toBe(100);
      expect(buildTime).toBeLessThan(500); // Should build efficiently for medium codebase

      console.log(`Medium codebase (100 files, 2000 symbols): ${buildTime.toFixed(2)}ms`);
    });

    it('should build indexes for large codebase within reasonable time', () => {
      const repoMap = generateLargeRepositoryMap(500, 30, 15);

      const startTime = performance.now();
      const resolver = new SymbolResolver(repoMap);
      const endTime = performance.now();

      const buildTime = endTime - startTime;
      const stats = resolver.getStats();

      expect(stats.totalSymbols).toBe(15000);
      expect(stats.filesWithSymbols).toBe(500);
      expect(buildTime).toBeLessThan(2000); // Should handle large codebase within 2 seconds

      console.log(`Large codebase (500 files, 15000 symbols): ${buildTime.toFixed(2)}ms`);
    });
  });

  describe('Search Performance', () => {
    let largeResolver: SymbolResolver;
    let mediumResolver: SymbolResolver;

    beforeEach(() => {
      // Set up resolvers with different sized codebases
      const mediumRepo = generateLargeRepositoryMap(100, 20, 10);
      mediumResolver = new SymbolResolver(mediumRepo);

      const largeRepo = generateLargeRepositoryMap(500, 30, 15);
      largeResolver = new SymbolResolver(largeRepo);
    });

    it('should find definitions quickly in medium codebase', () => {
      const symbolName = 'Symbol50_10'; // Symbol that should exist

      const startTime = performance.now();
      const definitions = mediumResolver.findDefinition(symbolName);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(10); // Should find quickly

      console.log(`Medium codebase definition search: ${searchTime.toFixed(3)}ms`);
    });

    it('should find definitions quickly in large codebase', () => {
      const symbolName = 'Symbol250_15'; // Symbol that should exist

      const startTime = performance.now();
      const definitions = largeResolver.findDefinition(symbolName);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(20); // Should find quickly even in large codebase

      console.log(`Large codebase definition search: ${searchTime.toFixed(3)}ms`);
    });

    it('should find references quickly', () => {
      const symbolName = 'Symbol0_0'; // First symbol, likely to have many references

      const startTime = performance.now();
      const references = largeResolver.findReferences(symbolName);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(searchTime).toBeLessThan(50); // Reference search is more expensive but should still be fast

      console.log(`Large codebase reference search (${references.length} refs): ${searchTime.toFixed(3)}ms`);
    });

    it('should handle partial matches efficiently', () => {
      const partialName = 'Symbol2'; // Should match many symbols

      const options: FindOptions = {
        exactMatch: false,
        limit: 10, // Limit results to keep test manageable
      };

      const startTime = performance.now();
      const definitions = largeResolver.findDefinition(partialName, options);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBe(10); // Should respect limit
      expect(searchTime).toBeLessThan(100); // Partial matching is more expensive

      console.log(`Partial match search (${definitions.length} results): ${searchTime.toFixed(3)}ms`);
    });

    it('should handle case-insensitive searches efficiently', () => {
      const symbolName = 'symbol250_15'; // Lowercase version of existing symbol

      const options: FindOptions = {
        caseSensitive: false,
      };

      const startTime = performance.now();
      const definitions = largeResolver.findDefinition(symbolName, options);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(30); // Case-insensitive search should still be fast

      console.log(`Case-insensitive search: ${searchTime.toFixed(3)}ms`);
    });
  });

  describe('Filter Performance', () => {
    let resolver: SymbolResolver;

    beforeEach(() => {
      const repoMap = generateLargeRepositoryMap(200, 25, 10);
      resolver = new SymbolResolver(repoMap);
    });

    it('should filter by symbol type efficiently', () => {
      const options: FindOptions = {
        symbolType: 'class',
        exactMatch: false,
      };

      const startTime = performance.now();
      const definitions = resolver.findDefinition('Symbol', options);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.every(def => def.symbol.type === 'class')).toBe(true);
      expect(searchTime).toBeLessThan(50);

      console.log(`Symbol type filter: ${searchTime.toFixed(3)}ms (${definitions.length} classes found)`);
    });

    it('should filter by file path efficiently', () => {
      const options: FindOptions = {
        filePath: 'src/module1*',
        exactMatch: false,
      };

      const startTime = performance.now();
      const definitions = resolver.findDefinition('Symbol', options);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.every(def => def.filePath.startsWith('src/module1'))).toBe(true);
      expect(searchTime).toBeLessThan(50);

      console.log(`File path filter: ${searchTime.toFixed(3)}ms (${definitions.length} symbols found)`);
    });

    it('should handle complex filters efficiently', () => {
      const options: FindOptions = {
        symbolType: ['class', 'interface'],
        exportedOnly: true,
        filePath: 'src/module*',
        exactMatch: false,
        limit: 20,
      };

      const startTime = performance.now();
      const definitions = resolver.findDefinition('Symbol', options);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBeLessThanOrEqual(20);
      expect(definitions.every(def =>
        (['class', 'interface'] as const).includes(def.symbol.type) &&
        def.symbol.exported
      )).toBe(true);
      expect(searchTime).toBeLessThan(100);

      console.log(`Complex filter: ${searchTime.toFixed(3)}ms (${definitions.length} symbols found)`);
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('should handle index rebuilding efficiently', () => {
      const repoMap = generateLargeRepositoryMap(100, 20, 10);
      const resolver = new SymbolResolver(repoMap);

      // Measure initial stats
      const initialStats = resolver.getStats();
      expect(initialStats.totalSymbols).toBe(2000);

      // Add more files to the repository map
      const additionalFiles = generateLargeRepositoryMap(50, 20, 10).files || [];
      repoMap.files!.push(...additionalFiles);

      // Rebuild index
      const rebuildStartTime = performance.now();
      resolver.rebuildIndex();
      const rebuildEndTime = performance.now();

      const rebuildTime = rebuildEndTime - rebuildStartTime;
      const newStats = resolver.getStats();

      expect(newStats.totalSymbols).toBe(3000); // Should include new symbols
      expect(rebuildTime).toBeLessThan(300); // Rebuild should be efficient

      console.log(`Index rebuild (added 50 files): ${rebuildTime.toFixed(2)}ms`);
    });

    it('should maintain performance across multiple searches', () => {
      const resolver = new SymbolResolver(generateLargeRepositoryMap(200, 25, 12));
      const searchTimes: number[] = [];

      // Perform multiple searches to test consistency
      for (let i = 0; i < 10; i++) {
        const symbolName = `Symbol${i * 10}_5`;

        const startTime = performance.now();
        resolver.findDefinition(symbolName);
        const endTime = performance.now();

        searchTimes.push(endTime - startTime);
      }

      const averageTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
      const maxTime = Math.max(...searchTimes);

      expect(averageTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(25); // Even the slowest search should be reasonable

      console.log(`Multiple searches - Avg: ${averageTime.toFixed(3)}ms, Max: ${maxTime.toFixed(3)}ms`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle extremely large symbol names', () => {
      // Create symbols with very long names
      const longSymbolName = 'VeryLongSymbolNameThatExceedsTypicalLengthsAndShouldStillBeHandledEfficiently'.repeat(5);

      const repoMap: RepositoryMap = {
        rootPath: '/test',
        files: [{
          path: 'test.ts',
          language: 'typescript',
          symbols: [{
            name: longSymbolName,
            type: 'class',
            filePath: 'test.ts',
            startLine: 1,
            endLine: 5,
            exported: true,
          }],
          lineCount: 10,
          lastModified: new Date(),
        }],
        references: [],
        stats: { totalFiles: 1, totalSymbols: 1, totalReferences: 0 },
      };

      const resolver = new SymbolResolver(repoMap);

      const startTime = performance.now();
      const definitions = resolver.findDefinition(longSymbolName);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBe(1);
      expect(searchTime).toBeLessThan(20); // Should handle long names efficiently

      console.log(`Long symbol name search (${longSymbolName.length} chars): ${searchTime.toFixed(3)}ms`);
    });

    it('should handle many duplicate symbol names', () => {
      const duplicateCount = 1000;
      const symbols: CodeSymbol[] = [];

      // Create many symbols with the same name but in different contexts
      for (let i = 0; i < duplicateCount; i++) {
        symbols.push({
          name: 'DuplicateSymbol',
          type: 'function',
          filePath: `file${Math.floor(i / 10)}.ts`,
          startLine: i % 10 + 1,
          endLine: i % 10 + 3,
          exported: i % 2 === 0,
        });
      }

      const repoMap: RepositoryMap = {
        rootPath: '/test',
        files: [{
          path: 'consolidated.ts',
          language: 'typescript',
          symbols,
          lineCount: 1000,
          lastModified: new Date(),
        }],
        references: [],
        stats: { totalFiles: 1, totalSymbols: duplicateCount, totalReferences: 0 },
      };

      const resolver = new SymbolResolver(repoMap);

      const startTime = performance.now();
      const definitions = resolver.findDefinition('DuplicateSymbol');
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(definitions.length).toBe(duplicateCount);
      expect(searchTime).toBeLessThan(50); // Should handle duplicates efficiently

      console.log(`Duplicate symbols search (${duplicateCount} matches): ${searchTime.toFixed(3)}ms`);
    });
  });
});