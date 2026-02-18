/**
 * @fileoverview JSDoc Coverage Report Tests
 *
 * Generates comprehensive reports on JSDoc documentation coverage
 * across all public APIs in the core package, ensuring consistent
 * documentation standards and identifying gaps.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('JSDoc Coverage Report Generation', () => {
  const utilsFilePath = path.join(__dirname, '..', 'utils.ts');
  const typesFilePath = path.join(__dirname, '..', 'types.ts');
  const configFilePath = path.join(__dirname, '..', 'config.ts');

  let utilsContent: string;
  let typesContent: string;
  let configContent: string;

  beforeAll(() => {
    utilsContent = fs.readFileSync(utilsFilePath, 'utf8');
    if (fs.existsSync(typesFilePath)) {
      typesContent = fs.readFileSync(typesFilePath, 'utf8');
    } else {
      typesContent = '';
    }
    if (fs.existsSync(configFilePath)) {
      configContent = fs.readFileSync(configFilePath, 'utf8');
    } else {
      configContent = '';
    }
  });

  interface CoverageAnalysis {
    totalExports: number;
    documentedExports: number;
    undocumentedExports: string[];
    coveragePercentage: number;
    exampleCoverage: number;
    interfacesWithExamples: string[];
    interfacesWithoutExamples: string[];
  }

  /**
   * Analyzes JSDoc coverage for a given file content
   */
  function analyzeCoverage(content: string, fileName: string): CoverageAnalysis {
    const exportedItems: string[] = [];
    const documentedItems: string[] = [];
    const undocumentedItems: string[] = [];
    const itemsWithExamples: string[] = [];
    const itemsWithoutExamples: string[] = [];

    // Find all exported interfaces, types, functions, and constants
    const exportPatterns = [
      /export interface (\w+)/g,
      /export type (\w+)/g,
      /export function (\w+)/g,
      /export const (\w+)/g,
      /export class (\w+)/g,
      /export enum (\w+)/g
    ];

    exportPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        exportedItems.push(match[1]);
      }
    });

    // Check which items have JSDoc documentation
    exportedItems.forEach(itemName => {
      const jsdocPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export (?:interface|type|function|const|class|enum) ${itemName}(?![a-zA-Z0-9_])`);

      if (jsdocPattern.test(content)) {
        documentedItems.push(itemName);

        // Check for @example tag
        const jsdocMatch = content.match(new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export (?:interface|type|function|const|class|enum) ${itemName}(?![a-zA-Z0-9_])`));
        if (jsdocMatch && jsdocMatch[1].includes('@example')) {
          itemsWithExamples.push(itemName);
        } else {
          itemsWithoutExamples.push(itemName);
        }
      } else {
        undocumentedItems.push(itemName);
        itemsWithoutExamples.push(itemName);
      }
    });

    return {
      totalExports: exportedItems.length,
      documentedExports: documentedItems.length,
      undocumentedExports: undocumentedItems,
      coveragePercentage: exportedItems.length > 0 ? (documentedItems.length / exportedItems.length) * 100 : 100,
      exampleCoverage: exportedItems.length > 0 ? (itemsWithExamples.length / exportedItems.length) * 100 : 100,
      interfacesWithExamples: itemsWithExamples,
      interfacesWithoutExamples: itemsWithoutExamples
    };
  }

  describe('Overall Coverage Analysis', () => {
    it('should achieve high JSDoc coverage across core files', () => {
      const utilsCoverage = analyzeCoverage(utilsContent, 'utils.ts');
      const typesCoverage = analyzeCoverage(typesContent, 'types.ts');
      const configCoverage = analyzeCoverage(configContent, 'config.ts');

      // Log detailed coverage information
      console.log('\n📊 JSDoc Coverage Report:');
      console.log('==========================');

      console.log(`\n📁 utils.ts:`);
      console.log(`   Documented: ${utilsCoverage.documentedExports}/${utilsCoverage.totalExports} (${utilsCoverage.coveragePercentage.toFixed(1)}%)`);
      console.log(`   With Examples: ${utilsCoverage.interfacesWithExamples.length}/${utilsCoverage.totalExports} (${utilsCoverage.exampleCoverage.toFixed(1)}%)`);
      if (utilsCoverage.undocumentedExports.length > 0) {
        console.log(`   ❌ Missing docs: ${utilsCoverage.undocumentedExports.join(', ')}`);
      }

      if (typesCoverage.totalExports > 0) {
        console.log(`\n📁 types.ts:`);
        console.log(`   Documented: ${typesCoverage.documentedExports}/${typesCoverage.totalExports} (${typesCoverage.coveragePercentage.toFixed(1)}%)`);
        console.log(`   With Examples: ${typesCoverage.interfacesWithExamples.length}/${typesCoverage.totalExports} (${typesCoverage.exampleCoverage.toFixed(1)}%)`);
        if (typesCoverage.undocumentedExports.length > 0) {
          console.log(`   ❌ Missing docs: ${typesCoverage.undocumentedExports.join(', ')}`);
        }
      }

      if (configCoverage.totalExports > 0) {
        console.log(`\n📁 config.ts:`);
        console.log(`   Documented: ${configCoverage.documentedExports}/${configCoverage.totalExports} (${configCoverage.coveragePercentage.toFixed(1)}%)`);
        console.log(`   With Examples: ${configCoverage.interfacesWithExamples.length}/${configCoverage.totalExports} (${configCoverage.exampleCoverage.toFixed(1)}%)`);
        if (configCoverage.undocumentedExports.length > 0) {
          console.log(`   ❌ Missing docs: ${configCoverage.undocumentedExports.join(', ')}`);
        }
      }

      // Calculate overall coverage
      const totalExports = utilsCoverage.totalExports + typesCoverage.totalExports + configCoverage.totalExports;
      const totalDocumented = utilsCoverage.documentedExports + typesCoverage.documentedExports + configCoverage.documentedExports;
      const overallCoverage = totalExports > 0 ? (totalDocumented / totalExports) * 100 : 100;

      console.log(`\n🎯 Overall Coverage: ${totalDocumented}/${totalExports} (${overallCoverage.toFixed(1)}%)`);

      // Expect high coverage (at least 80%)
      expect(overallCoverage).toBeGreaterThanOrEqual(80);
    });

    it('should have documentation for all critical interfaces', () => {
      const criticalInterfaces = [
        'SemVer',
        'ConventionalCommit',
        'CodeBlock',
        'ConflictInfo',
        'GitLogEntry',
        'TruncateOptions',
        'TruncateResult'
      ];

      const utilsCoverage = analyzeCoverage(utilsContent, 'utils.ts');
      const typesCoverage = analyzeCoverage(typesContent, 'types.ts');

      const allDocumentedInterfaces = [
        ...utilsCoverage.interfacesWithExamples,
        ...utilsCoverage.undocumentedExports.length === 0 ? [] : [],
        ...typesCoverage.interfacesWithExamples
      ];

      criticalInterfaces.forEach(interfaceName => {
        const hasUtilsDoc = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`).test(utilsContent);
        const hasTypesDoc = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`).test(typesContent);

        expect(hasUtilsDoc || hasTypesDoc).toBe(true);
      });
    });

    it('should have examples for all critical interfaces', () => {
      const criticalInterfaces = [
        'SemVer',
        'ConventionalCommit',
        'CodeBlock',
        'ConflictInfo',
        'GitLogEntry',
        'TruncateOptions',
        'TruncateResult'
      ];

      criticalInterfaces.forEach(interfaceName => {
        const utilsPattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
        const typesPattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);

        const utilsMatch = utilsContent.match(utilsPattern);
        const typesMatch = typesContent.match(typesPattern);

        const hasExample = (utilsMatch && utilsMatch[1].includes('@example')) ||
                          (typesMatch && typesMatch[1].includes('@example'));

        expect(hasExample).toBe(true);
      });
    });
  });

  describe('Documentation Quality Metrics', () => {
    it('should have comprehensive property documentation', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];

      criticalInterfaces.forEach(interfaceName => {
        // Find interface definition
        const interfacePattern = new RegExp(`export interface ${interfaceName}\\s*{([\\s\\S]*?)}`, 'g');
        const utilsMatch = utilsContent.match(interfacePattern);
        const typesMatch = typesContent.match(interfacePattern);
        const match = utilsMatch?.[0] || typesMatch?.[0];

        expect(match).toBeTruthy();

        if (match) {
          // Count properties
          const propertiesSection = match.match(/{([\s\S]*?)}/)?.[1];
          if (propertiesSection) {
            const propertyLines = propertiesSection
              .split('\n')
              .filter(line => line.includes(':') && !line.trim().startsWith('//') && !line.trim().startsWith('*'))
              .filter(line => !line.trim().startsWith('/**') && !line.trim().startsWith('*/'));

            // Count JSDoc comments for properties
            const jsdocComments = (propertiesSection.match(/\/\*\*[\s\S]*?\*\//g) || []).length;

            // Most properties should have documentation
            expect(jsdocComments).toBeGreaterThanOrEqual(Math.floor(propertyLines.length * 0.8));
          }
        }
      });
    });

    it('should use standard JSDoc tags appropriately', () => {
      const standardTags = ['@param', '@returns', '@throws', '@example', '@interface', '@deprecated', '@since'];
      const jsdocBlocks = utilsContent.match(/\/\*\*[\s\S]*?\*\//g) || [];

      jsdocBlocks.forEach(block => {
        // Should use at least one standard tag for non-trivial documentation
        if (block.length > 50) { // Non-trivial documentation
          const hasStandardTag = standardTags.some(tag => block.includes(tag));
          expect(hasStandardTag).toBe(true);
        }
      });
    });

    it('should maintain consistent documentation style', () => {
      const jsdocBlocks = utilsContent.match(/\/\*\*[\s\S]*?\*\//g) || [];

      jsdocBlocks.forEach(block => {
        // Should not mix different comment styles
        expect(block).not.toMatch(/\/\//); // No single-line comments inside JSDoc

        // Should have proper formatting
        const lines = block.split('\n');
        if (lines.length > 2) {
          lines.slice(1, -1).forEach(line => {
            if (line.trim()) {
              expect(line.trim().startsWith('*')).toBe(true);
            }
          });
        }
      });
    });
  });

  describe('Coverage Improvement Tracking', () => {
    it('should generate actionable improvement recommendations', () => {
      const utilsCoverage = analyzeCoverage(utilsContent, 'utils.ts');
      const typesCoverage = analyzeCoverage(typesContent, 'types.ts');

      console.log('\n📋 Documentation Improvement Recommendations:');
      console.log('===============================================');

      if (utilsCoverage.undocumentedExports.length > 0) {
        console.log('\n📝 Add documentation for these utils.ts exports:');
        utilsCoverage.undocumentedExports.forEach(item => {
          console.log(`   - ${item}`);
        });
      }

      if (utilsCoverage.interfacesWithoutExamples.length > 0) {
        console.log('\n💡 Add @example tags for these utils.ts exports:');
        utilsCoverage.interfacesWithoutExamples.forEach(item => {
          console.log(`   - ${item}`);
        });
      }

      if (typesCoverage.undocumentedExports.length > 0) {
        console.log('\n📝 Add documentation for these types.ts exports:');
        typesCoverage.undocumentedExports.forEach(item => {
          console.log(`   - ${item}`);
        });
      }

      console.log('\n✅ Documentation quality checks completed');

      // This test always passes but provides valuable reporting
      expect(true).toBe(true);
    });

    it('should track documentation completeness over time', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];
      const now = new Date().toISOString();

      const coverageSnapshot = {
        timestamp: now,
        criticalInterfacesCovered: criticalInterfaces.filter(interfaceName => {
          const pattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
          return pattern.test(utilsContent) || pattern.test(typesContent);
        }),
        totalCriticalInterfaces: criticalInterfaces.length
      };

      console.log(`\n📈 Coverage Snapshot (${now}):`);
      console.log(`Critical interfaces documented: ${coverageSnapshot.criticalInterfacesCovered.length}/${coverageSnapshot.totalCriticalInterfaces}`);
      console.log(`Documented interfaces: ${coverageSnapshot.criticalInterfacesCovered.join(', ')}`);

      // All critical interfaces should be documented
      expect(coverageSnapshot.criticalInterfacesCovered.length).toBe(coverageSnapshot.totalCriticalInterfaces);
    });
  });
});