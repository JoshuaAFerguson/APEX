/**
 * Integration verification tests for Codebase Intelligence
 *
 * Simple tests to verify that all components can be instantiated
 * and basic functionality works without external dependencies.
 */

import { describe, it, expect } from 'vitest';
import { SemanticSearch } from '../semantic-search.js';
import { ReferenceExtractor } from '../reference-extractor.js';
import { TypeRelationshipMap } from '../type-relationship-map.js';
import { CodebaseIntelligenceService } from '../codebase-intelligence-service.js';
import type { RepositoryMap } from '@apexcli/core/types';

describe('Codebase Intelligence Integration Verification', () => {
  const mockRepoMap: RepositoryMap = {
    rootPath: '/test',
    files: [
      {
        filePath: 'test.ts',
        language: 'typescript',
        content: 'export function test() { return true; }',
        symbols: [
          {
            name: 'test',
            type: 'function',
            filePath: 'test.ts',
            startLine: 1,
            endLine: 1,
            exported: true,
            signature: 'function test(): boolean'
          }
        ],
        imports: [],
        exports: ['test']
      }
    ],
    imports: [],
    references: [],
    stats: {
      totalFiles: 1,
      totalSymbols: 1,
      indexedAt: new Date(),
      processingTimeMs: 10
    }
  };

  describe('SemanticSearch', () => {
    it('should instantiate without errors', () => {
      expect(() => new SemanticSearch(mockRepoMap)).not.toThrow();
    });

    it('should perform basic search', () => {
      const search = new SemanticSearch(mockRepoMap);
      const results = search.search('test');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find similar symbols', () => {
      const search = new SemanticSearch(mockRepoMap);
      const symbol = mockRepoMap.files[0].symbols[0];

      expect(() => search.findSimilar(symbol)).not.toThrow();
    });

    it('should search by example', () => {
      const search = new SemanticSearch(mockRepoMap);

      expect(() => search.searchByExample('function test()')).not.toThrow();
    });
  });

  describe('ReferenceExtractor', () => {
    it('should instantiate without errors', () => {
      expect(() => new ReferenceExtractor(mockRepoMap)).not.toThrow();
    });

    it('should handle missing file gracefully', async () => {
      const extractor = new ReferenceExtractor(mockRepoMap);

      await expect(
        extractor.extractReferencesFromFile('nonexistent.ts', '', 'typescript')
      ).resolves.not.toThrow();
    });
  });

  describe('TypeRelationshipMap', () => {
    it('should instantiate without errors', () => {
      expect(() => new TypeRelationshipMap(mockRepoMap)).not.toThrow();
    });

    it('should build empty type graph', async () => {
      const typeMap = new TypeRelationshipMap(mockRepoMap);

      await expect(typeMap.buildTypeGraph()).resolves.not.toThrow();
    });

    it('should get hierarchy for non-existent type', () => {
      const typeMap = new TypeRelationshipMap(mockRepoMap);

      expect(() => typeMap.getHierarchy('NonExistent')).not.toThrow();
    });
  });

  describe('CodebaseIntelligenceService', () => {
    it('should instantiate without errors', () => {
      expect(() => new CodebaseIntelligenceService()).not.toThrow();
    });

    it('should provide status before initialization', () => {
      const service = new CodebaseIntelligenceService();
      const status = service.getStatus();

      expect(status.initialized).toBe(false);
      expect(status.filesIndexed).toBe(0);
    });

    it('should handle uninitialized state gracefully', () => {
      const service = new CodebaseIntelligenceService();

      expect(() => service.searchCode('test')).toThrow();
      expect(() => service.getImplementations('Test')).toThrow();
    });
  });

  describe('Factory Functions', () => {
    it('should create instances via factory functions', () => {
      const { createSemanticSearch } = require('../semantic-search.js');
      const { createReferenceExtractor } = require('../reference-extractor.js');
      const { createTypeRelationshipMap } = require('../type-relationship-map.js');
      const { createCodebaseIntelligenceService } = require('../codebase-intelligence-service.js');

      expect(() => createSemanticSearch(mockRepoMap)).not.toThrow();
      expect(() => createReferenceExtractor(mockRepoMap)).not.toThrow();
      expect(() => createTypeRelationshipMap(mockRepoMap)).not.toThrow();
      expect(() => createCodebaseIntelligenceService()).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should have proper TypeScript types', () => {
      const search = new SemanticSearch(mockRepoMap);
      const results = search.search('test', { limit: 5 });

      // TypeScript should ensure these properties exist
      results.forEach(result => {
        expect(typeof result.score).toBe('number');
        expect(typeof result.matchType).toBe('string');
        expect(result.symbol).toBeDefined();
        expect(result.file).toBeDefined();
      });
    });
  });
});