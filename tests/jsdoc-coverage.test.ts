import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import * as glob from 'glob';

/**
 * Interface representing a public API item
 */
interface PublicAPIItem {
  /** Type of API item */
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method';
  /** Name of the API item */
  name: string;
  /** File path where item is defined */
  filePath: string;
  /** Line number where item is defined */
  lineNumber: number;
  /** Whether this item has JSDoc documentation */
  hasJSDoc: boolean;
  /** Whether this item is exported */
  isExported: boolean;
  /** JSDoc content if available */
  jsDocContent?: string;
  /** Whether JSDoc has @param tags */
  hasParamDocs: boolean;
  /** Whether JSDoc has @returns tag */
  hasReturnsDocs: boolean;
  /** Whether JSDoc has @example tag */
  hasExampleDocs: boolean;
}

/**
 * Test suite for validating JSDoc coverage across all public APIs
 * Ensures comprehensive documentation for exported functions, classes, and interfaces
 */
describe('JSDoc Coverage Validation', () => {
  let publicAPIItems: PublicAPIItem[] = [];
  let coverageStats = {
    totalItems: 0,
    documentedItems: 0,
    itemsWithParams: 0,
    itemsWithReturns: 0,
    itemsWithExamples: 0,
    coverageByPackage: {} as Record<string, { total: number; documented: number }>
  };

  /**
   * Extract public API items from a file
   */
  async function extractPublicAPIItems(filePath: string): Promise<PublicAPIItem[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const items: PublicAPIItem[] = [];

    // Map line numbers to JSDoc comments
    const jsDocMap = new Map<number, string>();
    const jsDocRegex = /\/\*\*([\s\S]*?)\*\//g;
    let jsDocMatch;

    while ((jsDocMatch = jsDocRegex.exec(content)) !== null) {
      const startPos = jsDocMatch.index;
      const endPos = startPos + jsDocMatch[0].length;
      const startLine = content.substring(0, startPos).split('\n').length;
      const endLine = content.substring(0, endPos).split('\n').length;

      // Associate JSDoc with the next few lines
      for (let i = endLine; i <= Math.min(endLine + 3, lines.length); i++) {
        jsDocMap.set(i, jsDocMatch[1]);
      }
    }

    // Find public API items
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip empty lines and comments
      if (!line || line.startsWith('//') || line.startsWith('*')) continue;

      let apiItem: Partial<PublicAPIItem> | null = null;

      // Check for exported functions
      const functionMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        apiItem = {
          type: 'function',
          name: functionMatch[1],
          isExported: true
        };
      }

      // Check for exported classes
      const classMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        apiItem = {
          type: 'class',
          name: classMatch[1],
          isExported: true
        };
      }

      // Check for exported interfaces
      const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        apiItem = {
          type: 'interface',
          name: interfaceMatch[1],
          isExported: true
        };
      }

      // Check for exported type aliases
      const typeMatch = line.match(/^export\s+type\s+(\w+)/);
      if (typeMatch) {
        apiItem = {
          type: 'type',
          name: typeMatch[1],
          isExported: true
        };
      }

      // Check for exported constants/variables
      const variableMatch = line.match(/^export\s+(?:const|let|var)\s+(\w+)/);
      if (variableMatch) {
        apiItem = {
          type: 'variable',
          name: variableMatch[1],
          isExported: true
        };
      }

      // Check for exported arrow functions
      const arrowFunctionMatch = line.match(/^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/);
      if (arrowFunctionMatch) {
        apiItem = {
          type: 'function',
          name: arrowFunctionMatch[1],
          isExported: true
        };
      }

      // Check for class methods (public methods in exported classes)
      const methodMatch = line.match(/^\s+(?:public\s+)?(?:async\s+)?(\w+)\s*\(/);
      if (methodMatch && !line.includes('private') && !line.includes('protected')) {
        // Check if we're inside an exported class
        let inExportedClass = false;
        for (let j = i - 1; j >= Math.max(0, i - 50); j--) {
          if (lines[j].match(/^export\s+(?:abstract\s+)?class\s+\w+/)) {
            inExportedClass = true;
            break;
          }
          if (lines[j].includes('class ') && !lines[j].includes('export')) {
            break;
          }
        }

        if (inExportedClass) {
          apiItem = {
            type: 'method',
            name: methodMatch[1],
            isExported: true
          };
        }
      }

      if (apiItem) {
        // Check for JSDoc documentation
        const jsDocContent = jsDocMap.get(lineNumber) || jsDocMap.get(lineNumber - 1) || jsDocMap.get(lineNumber - 2);
        const hasJSDoc = !!jsDocContent;

        // Analyze JSDoc content if present
        let hasParamDocs = false;
        let hasReturnsDocs = false;
        let hasExampleDocs = false;

        if (jsDocContent) {
          hasParamDocs = jsDocContent.includes('@param');
          hasReturnsDocs = jsDocContent.includes('@returns') || jsDocContent.includes('@return');
          hasExampleDocs = jsDocContent.includes('@example');
        }

        items.push({
          ...apiItem,
          filePath,
          lineNumber,
          hasJSDoc,
          jsDocContent,
          hasParamDocs,
          hasReturnsDocs,
          hasExampleDocs
        } as PublicAPIItem);
      }
    }

    return items;
  }

  /**
   * Calculate coverage statistics
   */
  function calculateCoverageStats(): void {
    coverageStats.totalItems = publicAPIItems.length;
    coverageStats.documentedItems = publicAPIItems.filter(item => item.hasJSDoc).length;
    coverageStats.itemsWithParams = publicAPIItems.filter(item => item.hasParamDocs).length;
    coverageStats.itemsWithReturns = publicAPIItems.filter(item => item.hasReturnsDocs).length;
    coverageStats.itemsWithExamples = publicAPIItems.filter(item => item.hasExampleDocs).length;

    // Calculate coverage by package
    for (const item of publicAPIItems) {
      const packageMatch = item.filePath.match(/packages\/([^\/]+)\//);
      const packageName = packageMatch ? packageMatch[1] : 'unknown';

      if (!coverageStats.coverageByPackage[packageName]) {
        coverageStats.coverageByPackage[packageName] = { total: 0, documented: 0 };
      }

      coverageStats.coverageByPackage[packageName].total++;
      if (item.hasJSDoc) {
        coverageStats.coverageByPackage[packageName].documented++;
      }
    }
  }

  // Setup: extract all public API items
  beforeAll(async () => {
    const sourceFiles = glob.sync('packages/**/*.{ts,tsx}', {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.d.ts'
      ]
    });

    console.log(`Analyzing ${sourceFiles.length} files for public API coverage...`);

    for (const file of sourceFiles) {
      try {
        const items = await extractPublicAPIItems(file);
        publicAPIItems.push(...items);
      } catch (error) {
        console.warn(`Failed to analyze ${file}: ${error}`);
      }
    }

    calculateCoverageStats();
    console.log(`Found ${publicAPIItems.length} public API items`);
  }, 25000);

  describe('Overall Coverage', () => {
    it('should have reasonable JSDoc coverage for public APIs', () => {
      const coveragePercentage = coverageStats.totalItems > 0 ?
        (coverageStats.documentedItems / coverageStats.totalItems * 100) : 0;

      console.log(`\nOverall JSDoc coverage: ${coveragePercentage.toFixed(1)}% (${coverageStats.documentedItems}/${coverageStats.totalItems})`);

      // Expect at least 70% coverage for public APIs
      expect(coveragePercentage).toBeGreaterThan(70);
    });

    it('should document exported functions with parameters', () => {
      const functionsWithParams = publicAPIItems.filter(item =>
        item.type === 'function' && item.isExported
      );

      const undocumentedFunctions = functionsWithParams.filter(item => !item.hasJSDoc);

      if (undocumentedFunctions.length > 0) {
        console.log(`\nUndocumented functions (${undocumentedFunctions.length}/${functionsWithParams.length}):`);
        undocumentedFunctions.slice(0, 5).forEach(item => {
          console.log(`  ${item.filePath}:${item.lineNumber} - ${item.name}`);
        });
      }

      // Expect at least 80% of functions to be documented
      expect(undocumentedFunctions.length).toBeLessThan(functionsWithParams.length * 0.2);
    });

    it('should document exported classes', () => {
      const exportedClasses = publicAPIItems.filter(item =>
        item.type === 'class' && item.isExported
      );

      const undocumentedClasses = exportedClasses.filter(item => !item.hasJSDoc);

      if (undocumentedClasses.length > 0) {
        console.log(`\nUndocumented classes (${undocumentedClasses.length}/${exportedClasses.length}):`);
        undocumentedClasses.forEach(item => {
          console.log(`  ${item.filePath}:${item.lineNumber} - ${item.name}`);
        });
      }

      // Expect at least 90% of classes to be documented
      expect(undocumentedClasses.length).toBeLessThan(exportedClasses.length * 0.1);
    });

    it('should document public interfaces', () => {
      const exportedInterfaces = publicAPIItems.filter(item =>
        item.type === 'interface' && item.isExported
      );

      const undocumentedInterfaces = exportedInterfaces.filter(item => !item.hasJSDoc);

      if (undocumentedInterfaces.length > 0) {
        console.log(`\nUndocumented interfaces (${undocumentedInterfaces.length}/${exportedInterfaces.length}):`);
        undocumentedInterfaces.slice(0, 3).forEach(item => {
          console.log(`  ${item.filePath}:${item.lineNumber} - ${item.name}`);
        });
      }

      // Interfaces are very important to document
      expect(undocumentedInterfaces.length).toBeLessThan(exportedInterfaces.length * 0.1);
    });
  });

  describe('Package-Level Coverage', () => {
    it('should have good coverage across all packages', () => {
      console.log('\nCoverage by package:');

      for (const [packageName, stats] of Object.entries(coverageStats.coverageByPackage)) {
        const percentage = stats.total > 0 ? (stats.documented / stats.total * 100).toFixed(1) : '0.0';
        console.log(`  ${packageName}: ${percentage}% (${stats.documented}/${stats.total})`);

        // Each package should have at least 60% coverage
        if (stats.total >= 5) { // Only check packages with reasonable number of exports
          expect(stats.documented / stats.total).toBeGreaterThan(0.6);
        }
      }
    });

    it('should prioritize core package documentation', () => {
      const coreStats = coverageStats.coverageByPackage['core'];
      if (coreStats && coreStats.total > 0) {
        const corePercentage = coreStats.documented / coreStats.total;
        console.log(`Core package coverage: ${(corePercentage * 100).toFixed(1)}%`);

        // Core package should have high coverage
        expect(corePercentage).toBeGreaterThan(0.8);
      }
    });
  });

  describe('Documentation Quality', () => {
    it('should have parameter documentation for complex functions', () => {
      const functionsWithDocs = publicAPIItems.filter(item =>
        item.type === 'function' && item.hasJSDoc
      );

      const functionsWithParams = functionsWithDocs.filter(item => item.hasParamDocs);

      console.log(`Functions with parameter docs: ${functionsWithParams.length}/${functionsWithDocs.length}`);

      // Most documented functions should have parameter documentation
      if (functionsWithDocs.length > 0) {
        expect(functionsWithParams.length).toBeGreaterThan(functionsWithDocs.length * 0.6);
      }
    });

    it('should have return type documentation for functions', () => {
      const functionsWithDocs = publicAPIItems.filter(item =>
        item.type === 'function' && item.hasJSDoc
      );

      const functionsWithReturns = functionsWithDocs.filter(item => item.hasReturnsDocs);

      console.log(`Functions with return docs: ${functionsWithReturns.length}/${functionsWithDocs.length}`);

      // Many documented functions should have return documentation
      if (functionsWithDocs.length > 0) {
        expect(functionsWithReturns.length).toBeGreaterThan(functionsWithDocs.length * 0.4);
      }
    });

    it('should have examples for utility functions', () => {
      const utilityItems = publicAPIItems.filter(item =>
        item.filePath.includes('utils') || item.filePath.includes('helpers')
      );

      const utilityItemsWithExamples = utilityItems.filter(item => item.hasExampleDocs);

      console.log(`Utility items with examples: ${utilityItemsWithExamples.length}/${utilityItems.length}`);

      // Utility functions should often have examples
      if (utilityItems.length > 0) {
        expect(utilityItemsWithExamples.length).toBeGreaterThan(utilityItems.length * 0.3);
      }
    });
  });

  describe('API Distribution Analysis', () => {
    it('should have diverse API types', () => {
      const typeDistribution = publicAPIItems.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\nAPI type distribution:');
      Object.entries(typeDistribution).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      expect(Object.keys(typeDistribution).length).toBeGreaterThan(2);
    });

    it('should have APIs in core packages', () => {
      const corePackages = ['core', 'orchestrator', 'api', 'cli'];
      const coreItems = publicAPIItems.filter(item => {
        const packageMatch = item.filePath.match(/packages\/([^\/]+)\//);
        const packageName = packageMatch ? packageMatch[1] : '';
        return corePackages.includes(packageName);
      });

      console.log(`Core package APIs: ${coreItems.length}/${publicAPIItems.length}`);
      expect(coreItems.length).toBeGreaterThan(publicAPIItems.length * 0.5);
    });
  });

  describe('Coverage Summary', () => {
    it('should provide comprehensive coverage report', () => {
      const summary = {
        totalAPIs: coverageStats.totalItems,
        documentedAPIs: coverageStats.documentedItems,
        coveragePercentage: coverageStats.totalItems > 0 ?
          (coverageStats.documentedItems / coverageStats.totalItems * 100) : 0,
        functionsCount: publicAPIItems.filter(i => i.type === 'function').length,
        classesCount: publicAPIItems.filter(i => i.type === 'class').length,
        interfacesCount: publicAPIItems.filter(i => i.type === 'interface').length,
        withParams: coverageStats.itemsWithParams,
        withReturns: coverageStats.itemsWithReturns,
        withExamples: coverageStats.itemsWithExamples,
        packagesAnalyzed: Object.keys(coverageStats.coverageByPackage).length
      };

      console.log('\n=== JSDoc Coverage Analysis Summary ===');
      console.log(`🔍 Total public APIs analyzed: ${summary.totalAPIs}`);
      console.log(`📝 APIs with JSDoc: ${summary.documentedAPIs}`);
      console.log(`📊 Overall coverage: ${summary.coveragePercentage.toFixed(1)}%`);
      console.log(`🔧 Functions: ${summary.functionsCount}`);
      console.log(`🏗️  Classes: ${summary.classesCount}`);
      console.log(`📋 Interfaces: ${summary.interfacesCount}`);
      console.log(`🏷️  With @param docs: ${summary.withParams}`);
      console.log(`↩️  With @returns docs: ${summary.withReturns}`);
      console.log(`💡 With @example docs: ${summary.withExamples}`);
      console.log(`📦 Packages analyzed: ${summary.packagesAnalyzed}`);

      expect(summary.totalAPIs).toBeGreaterThan(0);
      expect(summary.coveragePercentage).toBeGreaterThan(70);
    });
  });
});