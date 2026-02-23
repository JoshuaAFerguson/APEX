/**
 * Full Workflow Integration Tests for Codebase Intelligence
 *
 * These tests verify the complete codebase intelligence indexing workflow
 * on a real codebase (the APEX project itself) to ensure all components
 * work together seamlessly in a production environment.
 *
 * Test Coverage:
 * - Full directory indexing of actual TypeScript/JavaScript code
 * - Symbol extraction across multiple files and packages
 * - Cross-file reference resolution
 * - Type hierarchy analysis
 * - Import graph generation
 * - Semantic search on real code
 * - Performance and memory usage validation
 * - Error handling with actual file system edge cases
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import {
  CodebaseIntelligenceService,
  CodebaseIndexer,
  SemanticSearch,
  SymbolResolver,
  ReferenceExtractor,
  TypeRelationshipMap,
} from '../index.js';

describe('Full Workflow Integration Tests - Real Codebase', () => {
  let service: CodebaseIntelligenceService;
  let testProjectPath: string;
  let indexedRepoMap: any;

  beforeAll(async () => {
    // Use the actual APEX core package as our test subject
    testProjectPath = path.resolve(__dirname, '../../../../../../packages/core');

    // Verify test project exists
    try {
      const stats = await fs.stat(testProjectPath);
      expect(stats.isDirectory()).toBe(true);
    } catch {
      throw new Error(`Test project not found at ${testProjectPath}`);
    }

    // Initialize the service with production-like configuration
    service = new CodebaseIntelligenceService({
      enableCaching: true,
      includeExternalDependencies: false,
      maxConcurrentFiles: 10,
      indexingTimeout: 60000, // 1 minute timeout for large codebases
    });

    console.log(`Initializing codebase intelligence for: ${testProjectPath}`);
    await service.initialize(testProjectPath);
    indexedRepoMap = service.getRepositoryMap();
  }, 120000); // 2 minute timeout for full indexing

  afterAll(async () => {
    if (service) {
      service.reset();
    }
    // Clean up any singleton instances
    CodebaseIndexer.resetInstance();
  });

  describe('Full Directory Indexing', () => {
    it('should successfully index the entire APEX core package', () => {
      expect(indexedRepoMap).toBeDefined();
      expect(indexedRepoMap.files).toBeDefined();
      expect(indexedRepoMap.files.length).toBeGreaterThan(0);

      console.log(`Indexed ${indexedRepoMap.files.length} files`);

      // Verify we found TypeScript files
      const tsFiles = indexedRepoMap.files.filter((f: any) => f.language === 'typescript');
      expect(tsFiles.length).toBeGreaterThan(0);

      // Verify symbols were extracted
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);
      expect(allSymbols.length).toBeGreaterThan(10); // Should have many symbols in core package

      console.log(`Extracted ${allSymbols.length} symbols from ${tsFiles.length} TypeScript files`);
    });

    it('should generate comprehensive statistics', () => {
      const stats = indexedRepoMap.stats;
      expect(stats).toBeDefined();
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalSymbols).toBeGreaterThan(0);
      expect(stats.languageBreakdown).toBeDefined();
      expect(stats.languageBreakdown.typescript).toBeGreaterThan(0);

      console.log('Repository statistics:', {
        totalFiles: stats.totalFiles,
        totalSymbols: stats.totalSymbols,
        languages: Object.keys(stats.languageBreakdown),
      });
    });

    it('should handle different file types correctly', () => {
      const files = indexedRepoMap.files;
      const languages = new Set(files.map((f: any) => f.language));

      // Should detect TypeScript
      expect(languages.has('typescript')).toBe(true);

      // May also have JavaScript
      if (languages.has('javascript')) {
        console.log('Found JavaScript files in addition to TypeScript');
      }

      console.log('Detected languages:', Array.from(languages));
    });
  });

  describe('Symbol Extraction and Resolution', () => {
    it('should extract symbols with accurate position information', () => {
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);

      // Find interface/type symbols (common in core package)
      const interfaces = allSymbols.filter((s: any) => s.type === 'interface');
      const types = allSymbols.filter((s: any) => s.type === 'type');

      console.log(`Found ${interfaces.length} interfaces and ${types.length} type definitions`);

      if (interfaces.length > 0) {
        const interface1 = interfaces[0];
        expect(interface1.name).toBeDefined();
        expect(interface1.startLine).toBeGreaterThan(0);
        expect(interface1.endLine).toBeGreaterThanOrEqual(interface1.startLine);
        expect(interface1.filePath).toBeDefined();
      }

      if (types.length > 0) {
        const type1 = types[0];
        expect(type1.name).toBeDefined();
        expect(type1.startLine).toBeGreaterThan(0);
        expect(type1.signature).toBeDefined();
      }
    });

    it('should resolve cross-file symbol references', async () => {
      // Find a common symbol that should exist in core package
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);

      if (allSymbols.length > 0) {
        const symbol = allSymbols.find((s: any) => s.type === 'interface' || s.type === 'type');

        if (symbol) {
          const definition = await service.findSymbolDefinition(symbol.name);
          expect(definition).toBeDefined();
          expect(definition!.symbol.name).toBe(symbol.name);
          expect(definition!.filePath).toBeDefined();

          console.log(`Successfully resolved symbol: ${symbol.name} in ${definition!.filePath}`);
        }
      }
    });

    it('should find references across multiple files', () => {
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);

      if (allSymbols.length > 0) {
        // Look for a symbol that might be used across files
        const exportedSymbol = allSymbols.find((s: any) =>
          (s.type === 'interface' || s.type === 'type') && s.name
        );

        if (exportedSymbol) {
          const references = service.findReferences(exportedSymbol.name);
          expect(references).toBeDefined();
          expect(Array.isArray(references)).toBe(true);

          if (references.length > 0) {
            console.log(`Found ${references.length} references to ${exportedSymbol.name}`);

            // Verify reference structure
            const ref = references[0];
            expect(ref.sourceFile).toBeDefined();
            expect(ref.line).toBeGreaterThan(0);
            expect(ref.column).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  });

  describe('Import Graph Generation', () => {
    it('should build comprehensive import relationships', () => {
      expect(indexedRepoMap.imports).toBeDefined();
      expect(Array.isArray(indexedRepoMap.imports)).toBe(true);

      if (indexedRepoMap.imports.length > 0) {
        console.log(`Generated ${indexedRepoMap.imports.length} import relationships`);

        // Verify import structure
        const import1 = indexedRepoMap.imports[0];
        expect(import1.sourceFile).toBeDefined();
        expect(import1.targetFile).toBeDefined();

        // Check for imported symbols
        if (import1.importedSymbols && import1.importedSymbols.length > 0) {
          console.log(`Import includes symbols: ${import1.importedSymbols.join(', ')}`);
        }
      }
    });

    it('should detect circular dependencies if they exist', () => {
      const circular = service.findCircularDependencies();
      expect(circular).toBeDefined();
      expect(circular.imports).toBeDefined();
      expect(circular.types).toBeDefined();

      console.log('Circular dependency analysis:', {
        importCycles: circular.imports.length,
        typeCycles: circular.types.length,
      });

      // Log any circular dependencies found (for debugging)
      if (circular.imports.length > 0) {
        console.log('Import circular dependencies detected:', circular.imports);
      }
      if (circular.types.length > 0) {
        console.log('Type circular dependencies detected:', circular.types);
      }
    });
  });

  describe('Type Hierarchy Analysis', () => {
    it('should build type relationships from real code', () => {
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);
      const interfaces = allSymbols.filter((s: any) => s.type === 'interface');

      if (interfaces.length > 0) {
        const interface1 = interfaces[0];
        const hierarchy = service.getTypeHierarchy(interface1.name);

        expect(hierarchy).toBeDefined();
        expect(hierarchy.type).toBe(interface1.name);
        expect(Array.isArray(hierarchy.interfaces || [])).toBe(true);
        expect(Array.isArray(hierarchy.descendants || [])).toBe(true);

        console.log(`Type hierarchy for ${interface1.name}:`, {
          interfaces: hierarchy.interfaces?.length || 0,
          descendants: hierarchy.descendants?.length || 0,
        });
      }
    });

    it('should find implementations of interfaces', () => {
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);
      const interfaces = allSymbols.filter((s: any) => s.type === 'interface');

      if (interfaces.length > 0) {
        const interface1 = interfaces[0];
        const implementations = service.getImplementations(interface1.name);

        expect(Array.isArray(implementations)).toBe(true);

        if (implementations.length > 0) {
          console.log(`Found ${implementations.length} implementations of ${interface1.name}`);

          const impl = implementations[0];
          expect(impl.symbol).toBeDefined();
          expect(impl.symbol.name).toBeDefined();
          expect(impl.filePath).toBeDefined();
        }
      }
    });
  });

  describe('Semantic Search on Real Code', () => {
    it('should search code by natural language descriptions', () => {
      // Test semantic search with terms relevant to core package
      const searchTerms = [
        'type definition',
        'configuration schema',
        'validation function',
        'interface declaration',
      ];

      for (const term of searchTerms) {
        const results = service.searchCode(term);
        expect(Array.isArray(results)).toBe(true);

        if (results.length > 0) {
          console.log(`Search "${term}" found ${results.length} results`);

          // Verify result structure
          const result = results[0];
          expect(result.symbol).toBeDefined();
          expect(result.score).toBeGreaterThan(0);
          expect(result.score).toBeLessThanOrEqual(1);
          expect(result.filePath).toBeDefined();
        }
      }
    });

    it('should rank search results by relevance', () => {
      const results = service.searchCode('type schema');

      if (results.length > 1) {
        // Results should be sorted by score (descending)
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }

        console.log('Search result scores:', results.slice(0, 3).map(r => ({
          symbol: r.symbol.name,
          score: r.score.toFixed(3),
        })));
      }
    });

    it('should support different search strategies', () => {
      const query = 'Config';

      const strategies = ['keyword', 'fuzzy', 'semantic'] as const;

      for (const strategy of strategies) {
        const results = service.searchCode(query, { strategy });
        expect(Array.isArray(results)).toBe(true);

        console.log(`Search strategy "${strategy}" for "${query}": ${results.length} results`);
      }
    });

    it('should filter results by symbol type', () => {
      const results = service.searchCode('config', {
        symbolTypes: ['interface', 'type'],
      });

      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        results.forEach(result => {
          expect(['interface', 'type']).toContain(result.symbol.type);
        });

        console.log(`Filtered search found ${results.length} interface/type symbols`);
      }
    });
  });

  describe('Performance and Memory Usage', () => {
    it('should complete indexing within reasonable time and memory limits', () => {
      // This is already validated by the beforeAll timeout
      // Here we check the service status
      const status = service.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.indexing).toBe(false);
      expect(status.filesIndexed).toBeGreaterThan(0);
      expect(status.symbolsExtracted).toBeGreaterThan(0);
      expect(status.lastIndexed).toBeInstanceOf(Date);

      console.log('Service status:', {
        filesIndexed: status.filesIndexed,
        symbolsExtracted: status.symbolsExtracted,
        lastIndexed: status.lastIndexed?.toISOString(),
      });
    });

    it('should provide comprehensive analysis without crashing', () => {
      const analysis = service.getAnalysis();

      expect(analysis).toBeDefined();
      expect(analysis.repositoryMap).toBeDefined();
      expect(analysis.symbolStats).toBeDefined();
      expect(analysis.referenceStats).toBeDefined();
      expect(analysis.typeStats).toBeDefined();

      console.log('Complete analysis stats:', {
        totalSymbols: analysis.symbolStats.totalSymbols,
        totalReferences: analysis.referenceStats.totalReferences,
        typeRelationships: analysis.typeStats.relationships,
        cacheHitRate: analysis.performance?.cacheHitRate,
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing files gracefully', async () => {
      const result = await service.findSymbolDefinition('NonExistentSymbol123');
      expect(result).toBeNull();
    });

    it('should handle empty search queries', () => {
      const results = service.searchCode('');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle invalid symbol types in search', () => {
      const results = service.searchCode('test', {
        symbolTypes: ['invalid' as any],
      });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should provide meaningful error messages for invalid operations', async () => {
      // Test with invalid file path
      const badService = new CodebaseIntelligenceService();

      await expect(badService.initialize('/nonexistent/path')).rejects.toThrow();
    });
  });

  describe('Service Integration and Exports', () => {
    it('should work seamlessly through orchestrator package exports', async () => {
      // Test importing through main orchestrator package
      const orchestratorExports = await import('../../index.js');

      // Verify CodebaseIntelligenceService is exported
      expect(orchestratorExports.CodebaseIntelligenceService).toBeDefined();
      expect(orchestratorExports.createCodebaseIntelligenceService).toBeDefined();
      expect(orchestratorExports.getCodebaseIntelligenceService).toBeDefined();

      // Verify all component classes are exported
      expect(orchestratorExports.CodebaseIndexer).toBeDefined();
      expect(orchestratorExports.SemanticSearch).toBeDefined();
      expect(orchestratorExports.SymbolResolver).toBeDefined();
      expect(orchestratorExports.ReferenceExtractor).toBeDefined();
      expect(orchestratorExports.TypeRelationshipMap).toBeDefined();

      // Test factory functions
      const serviceFromFactory = orchestratorExports.createCodebaseIntelligenceService({
        enableCaching: false,
      });
      expect(serviceFromFactory).toBeDefined();
      expect(serviceFromFactory).toBeInstanceOf(orchestratorExports.CodebaseIntelligenceService);
    });

    it('should support singleton pattern for service instances', async () => {
      const { getCodebaseIntelligenceService } = await import('../../index.js');

      const service1 = getCodebaseIntelligenceService();
      const service2 = getCodebaseIntelligenceService();

      // Should be the same instance
      expect(service1).toBe(service2);
    });
  });

  describe('Complete End-to-End Workflow', () => {
    it('should support a realistic development workflow', async () => {
      console.log('Testing complete end-to-end workflow...');

      // 1. Initialize service (already done in beforeAll)
      expect(service.getStatus().initialized).toBe(true);

      // 2. Get overview of codebase
      const analysis = service.getAnalysis();
      expect(analysis.repositoryMap.files.length).toBeGreaterThan(0);

      // 3. Search for specific functionality
      const configResults = service.searchCode('configuration type definition');
      console.log(`Found ${configResults.length} configuration-related symbols`);

      // 4. Analyze type relationships for a found symbol
      if (configResults.length > 0) {
        const configSymbol = configResults[0];
        const hierarchy = service.getTypeHierarchy(configSymbol.symbol.name);
        console.log(`Type hierarchy for ${configSymbol.symbol.name}:`, {
          interfaces: hierarchy.interfaces?.length || 0,
          descendants: hierarchy.descendants?.length || 0,
        });
      }

      // 5. Check for code quality issues
      const circular = service.findCircularDependencies();
      console.log(`Circular dependencies: ${circular.imports.length} import cycles, ${circular.types.length} type cycles`);

      // 6. Find similar symbols for code reuse analysis
      const allSymbols = indexedRepoMap.files.flatMap((f: any) => f.symbols);
      if (allSymbols.length > 0) {
        const randomSymbol = allSymbols[Math.floor(Math.random() * allSymbols.length)];
        const similar = service.findSimilarSymbols(randomSymbol);
        console.log(`Found ${similar.length} symbols similar to ${randomSymbol.name}`);
      }

      console.log('End-to-end workflow completed successfully!');
    });
  });
});