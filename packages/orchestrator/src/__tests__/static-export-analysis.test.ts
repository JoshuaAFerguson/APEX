/**
 * Static Export Analysis for CodebaseIndexer
 *
 * This test performs static analysis to verify that CodebaseIndexer exports
 * are properly configured in the source files without requiring runtime execution.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

describe('Static Export Analysis', () => {
  const orchestratorSrcPath = resolve(__dirname, '..');
  const codebaseIntelligenceIndexPath = join(orchestratorSrcPath, 'codebase-intelligence', 'index.ts');
  const mainIndexPath = join(orchestratorSrcPath, 'index.ts');

  describe('Source File Export Analysis', () => {
    it('should export CodebaseIndexer from codebase-intelligence/index.ts', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Check for the specific export line
      expect(content).toMatch(/export\s*{\s*CodebaseIndexer[\s,]/);
      expect(content).toMatch(/export\s*{\s*[^}]*getCodebaseIndexer[\s,}]/);

      // Check for type exports
      expect(content).toMatch(/export\s*type\s*{\s*[^}]*IndexingOptions/);
      expect(content).toMatch(/export\s*type\s*{\s*[^}]*IndexingProgress/);
      expect(content).toMatch(/export\s*type\s*{\s*[^}]*IndexingError/);
    });

    it('should re-export codebase-intelligence from main index.ts', () => {
      const content = readFileSync(mainIndexPath, 'utf-8');

      // Check for re-export of the entire codebase-intelligence module
      expect(content).toMatch(/export\s*\*\s*from\s*['"]\.\/codebase-intelligence\/index\.js['"];?/);
    });

    it('should have proper import path in codebase-intelligence index', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Check that indexer is imported from the correct relative path
      expect(content).toMatch(/from\s*['"]\.\/indexer\.js['"];?/);
    });
  });

  describe('Export Statement Validation', () => {
    it('should use named exports for CodebaseIndexer', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Should use named exports, not default export
      expect(content).not.toMatch(/export\s*default\s*CodebaseIndexer/);
      expect(content).toMatch(/export\s*{\s*CodebaseIndexer/);
    });

    it('should export helper function alongside main class', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Both CodebaseIndexer and helper function should be in same export statement
      const exportMatch = content.match(/export\s*{\s*([^}]+)\s*}\s*from\s*['"]\.\/indexer\.js['"];?/);
      expect(exportMatch).toBeTruthy();

      if (exportMatch) {
        const exportList = exportMatch[1];
        expect(exportList).toMatch(/CodebaseIndexer/);
        expect(exportList).toMatch(/getCodebaseIndexer/);
      }
    });

    it('should use proper file extension in import paths', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Should use .js extension for ES modules
      expect(content).toMatch(/from\s*['"][^'"]*\.js['"];?/);
      expect(content).not.toMatch(/from\s*['"][^'"]*\.ts['"];?/);
    });
  });

  describe('Module Structure Analysis', () => {
    it('should maintain consistent export pattern with other modules', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Should follow the established pattern of re-exporting from submodules
      expect(content).toMatch(/export\s*\*\s*from\s*['"]\.\/parsers\/index\.js['"];?/);
      expect(content).toMatch(/export\s*\*\s*from\s*['"]\.\/extractors\/index\.js['"];?/);
    });

    it('should have documentation comments for the module', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Should have module-level JSDoc
      expect(content).toMatch(/\/\*\*[\s\S]*\*\//);
      expect(content).toMatch(/Codebase Intelligence Module/i);
    });

    it('should include usage examples in documentation', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Should have example usage in JSDoc
      expect(content).toMatch(/@example/);
      expect(content).toMatch(/CodebaseIndexer/);
      expect(content).toMatch(/getInstance/);
    });
  });

  describe('Import Resolution Analysis', () => {
    it('should use consistent relative imports', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // All relative imports should start with ./
      const imports = content.match(/from\s*['"]([^'"]+)['"];?/g);
      if (imports) {
        const relativeImports = imports.filter(imp => imp.includes('./'));
        expect(relativeImports.length).toBeGreaterThan(0);

        relativeImports.forEach(imp => {
          expect(imp).toMatch(/from\s*['"]\.\/[^'"]*\.js['"];?/);
        });
      }
    });

    it('should not have circular import issues', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Should not import from the main index to avoid circular dependencies
      expect(content).not.toMatch(/from\s*['"]\.\.\/index\.js['"];?/);
      expect(content).not.toMatch(/from\s*['"]\.\/index\.js['"];?/);
    });
  });

  describe('Export Completeness Check', () => {
    it('should export all required indexer types and functions', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Check for all expected exports from indexer
      const requiredExports = [
        'CodebaseIndexer',
        'getCodebaseIndexer',
        'IndexingOptions',
        'IndexingProgress',
        'IndexingError'
      ];

      requiredExports.forEach(exportName => {
        expect(content).toMatch(new RegExp(`\\b${exportName}\\b`));
      });
    });

    it('should maintain export order consistency', () => {
      const content = readFileSync(codebaseIntelligenceIndexPath, 'utf-8');

      // Check that exports are organized logically
      const parserExportIndex = content.indexOf("export * from './parsers/index.js'");
      const extractorExportIndex = content.indexOf("export * from './extractors/index.js'");
      const indexerExportIndex = content.indexOf("export { CodebaseIndexer");

      expect(parserExportIndex).toBeGreaterThan(-1);
      expect(extractorExportIndex).toBeGreaterThan(-1);
      expect(indexerExportIndex).toBeGreaterThan(-1);

      // Logical order: parsers, then extractors, then indexer
      expect(parserExportIndex).toBeLessThan(extractorExportIndex);
      expect(extractorExportIndex).toBeLessThan(indexerExportIndex);
    });
  });

  describe('Main Index Integration Check', () => {
    it('should include codebase-intelligence in main orchestrator exports', () => {
      const content = readFileSync(mainIndexPath, 'utf-8');

      // Should include the wildcard export
      expect(content).toMatch(/export\s*\*\s*from\s*['"]\.\/codebase-intelligence\/index\.js['"];?/);
    });

    it('should not have duplicate CodebaseIndexer exports in main index', () => {
      const content = readFileSync(mainIndexPath, 'utf-8');

      // Should not have explicit CodebaseIndexer export since it's included via wildcard
      // Count occurrences of CodebaseIndexer export statements
      const explicitExports = (content.match(/export\s*{\s*[^}]*CodebaseIndexer/g) || []).length;

      // Should be 0 since it's exported via wildcard from codebase-intelligence
      expect(explicitExports).toBe(0);
    });
  });
});