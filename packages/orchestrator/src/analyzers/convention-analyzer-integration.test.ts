/**
 * ConventionAnalyzer Integration Tests
 *
 * Tests focusing on the file scanning infrastructure and integration aspects
 * of the ConventionAnalyzer that would interact with actual project files.
 */

import { ConventionAnalyzer } from './convention-analyzer';
import { BaseAnalyzer } from './base-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('ConventionAnalyzer - Integration Tests', () => {
  let analyzer: ConventionAnalyzer;

  beforeEach(() => {
    analyzer = new ConventionAnalyzer();
  });

  describe('class inheritance and structure', () => {
    it('should properly extend BaseAnalyzer', () => {
      expect(analyzer).toBeInstanceOf(BaseAnalyzer);
      expect(analyzer).toBeInstanceOf(ConventionAnalyzer);
    });

    it('should have the correct analyzer type', () => {
      expect(analyzer.type).toBe('conventions');
    });

    it('should implement StrategyAnalyzer interface completely', () => {
      // Verify all required interface methods are present
      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.prioritize).toBe('function');
      expect(typeof analyzer.type).toBe('string');
    });
  });

  describe('file scanning infrastructure preparation', () => {
    it('should handle projects with various file types', () => {
      const multiLanguageAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 120,
          lines: 15000,
          languages: {
            'TypeScript': 5000,
            'JavaScript': 3000,
            'Python': 2500,
            'Go': 2000,
            'Rust': 1500,
            'Java': 1000,
          },
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 150,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [],
        },
        documentation: {
          coverage: 60,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 70,
            details: { documentedItems: 7, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 800000,
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 75,
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(multiLanguageAnalysis);

      expect(Array.isArray(candidates)).toBe(true);
      // Should detect indentation issues in multi-language projects
      const indentationIssue = candidates.find(c => c.title.includes('indentation'));
      expect(indentationIssue).toBeDefined();
    });

    it('should handle edge case of single-language projects', () => {
      const singleLanguageAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 80,
          lines: 8000,
          languages: {
            'TypeScript': 8000, // Only TypeScript
          },
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 25, // Below threshold
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [],
        },
        documentation: {
          coverage: 80, // Good coverage
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 85,
            details: { documentedItems: 17, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 400000,
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 85,
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(singleLanguageAnalysis);

      // Should not trigger multi-language indentation issues
      const indentationIssue = candidates.find(c => c.title.includes('indentation'));
      expect(indentationIssue).toBeUndefined();
    });
  });

  describe('convention detection patterns', () => {
    it('should detect naming convention inconsistencies through lint issues', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { 'TypeScript': 5000 } },
        dependencies: { outdated: [], security: [], outdatedPackages: [], securityIssues: [], deprecatedPackages: [] },
        codeQuality: {
          lintIssues: 200, // High lint issues often indicate naming problems
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [],
        },
        documentation: {
          coverage: 70,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { percentage: 70, details: { documentedItems: 7, undocumentedItems: [] } },
        },
        performance: { bundleSize: 500000, slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 80, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(analysis);

      const formattingIssue = candidates.find(c => c.title.includes('formatting'));
      expect(formattingIssue).toBeDefined();
      expect(formattingIssue?.rationale).toContain('formatting');
    });

    it('should detect import/export inconsistencies through code duplication', () => {
      const duplicatedCodeAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 60, lines: 6000, languages: { 'TypeScript': 4000, 'JavaScript': 2000 } },
        dependencies: { outdated: [], security: [], outdatedPackages: [], securityIssues: [], deprecatedPackages: [] },
        codeQuality: {
          lintIssues: 30,
          duplicatedCode: [
            {
              pattern: 'import statements',
              similarity: 0.85,
              locations: [
                { file: 'src/utils/index.ts', startLine: 1, endLine: 5 },
                { file: 'src/components/index.ts', startLine: 1, endLine: 5 },
                { file: 'src/services/index.ts', startLine: 1, endLine: 5 },
              ]
            },
            {
              pattern: 'export patterns',
              similarity: 0.90,
              locations: [
                { file: 'src/types/user.ts', startLine: 20, endLine: 25 },
                { file: 'src/types/admin.ts', startLine: 15, endLine: 20 },
              ]
            },
            // Add more to trigger threshold
            { pattern: 'dup3', similarity: 0.7, locations: [{ file: 'f1.ts', startLine: 1, endLine: 5 }] },
            { pattern: 'dup4', similarity: 0.6, locations: [{ file: 'f2.ts', startLine: 1, endLine: 5 }] },
          ],
          complexityHotspots: [],
          codeSmells: [],
        },
        documentation: {
          coverage: 75,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { percentage: 75, details: { documentedItems: 15, undocumentedItems: [] } },
        },
        performance: { bundleSize: 600000, slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 80, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(duplicatedCodeAnalysis);

      const importIssue = candidates.find(c => c.title.includes('imports'));
      expect(importIssue).toBeDefined();
      expect(importIssue?.remediationSuggestions).toBeDefined();

      const organizeSuggestion = importIssue?.remediationSuggestions?.find(s =>
        s.command?.includes('organize-imports')
      );
      expect(organizeSuggestion).toBeDefined();
    });
  });

  describe('real-world scenario simulation', () => {
    it('should handle a typical legacy codebase with multiple convention issues', () => {
      const legacyCodebaseAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 250,
          lines: 35000,
          languages: {
            'JavaScript': 15000,
            'TypeScript': 10000,
            'Python': 5000,
            'Java': 3000,
            'PHP': 2000,
          },
        },
        dependencies: {
          outdated: ['express@3.0.0', 'lodash@3.10.1'],
          security: [{ package: 'old-package', vulnerability: 'CVE-2021-1234' }],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 750, // Many issues
          duplicatedCode: Array(15).fill(0).map((_, i) => ({
            pattern: `legacy-pattern-${i}`,
            similarity: 0.8,
            locations: [
              { file: `legacy/module${i}A.js`, startLine: 1, endLine: 20 },
              { file: `legacy/module${i}B.js`, startLine: 5, endLine: 25 },
            ]
          })),
          complexityHotspots: Array(25).fill(0).map((_, i) => ({
            file: `legacy/complex${i}.js`,
            function: `legacyFunction${i}`,
            complexity: 20 + (i % 10),
            type: 'cyclomatic' as const,
            line: 50 + i,
            reasons: ['nested conditions', 'large function', 'multiple responsibilities'],
          })),
          codeSmells: [],
        },
        documentation: {
          coverage: 25, // Poor documentation
          missingDocs: Array(50).fill(0).map((_, i) => `undocumented${i}.js`),
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 30,
            details: { documentedItems: 15, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 2500000, // Large bundle
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 40, // Poor test coverage
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(legacyCodebaseAnalysis);

      // Should detect multiple types of convention issues
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.length).toBeLessThanOrEqual(5); // Should limit results

      // Should have high-priority formatting issues
      const formattingIssue = candidates.find(c => c.title.includes('formatting'));
      expect(formattingIssue).toBeDefined();
      expect(formattingIssue?.priority).toBe('high');

      // Should have documentation issues
      const docIssue = candidates.find(c => c.title.includes('documentation'));
      expect(docIssue).toBeDefined();

      // Should have import/organization issues
      const importIssue = candidates.find(c => c.title.includes('imports'));
      expect(importIssue).toBeDefined();

      // Should have indentation issues due to multi-language
      const indentationIssue = candidates.find(c => c.title.includes('indentation'));
      expect(indentationIssue).toBeDefined();

      // Verify all candidates have proper structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^conventions-/);
        expect(candidate.suggestedWorkflow).toBe('conventions');
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(candidate.remediationSuggestions!.length).toBeGreaterThan(0);
      });
    });

    it('should handle a well-maintained modern codebase gracefully', () => {
      const modernCodebaseAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 80,
          lines: 12000,
          languages: {
            'TypeScript': 10000,
            'JavaScript': 2000,
          },
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: [],
        },
        codeQuality: {
          lintIssues: 15, // Very few issues
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [],
        },
        documentation: {
          coverage: 95, // Excellent documentation
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 95,
            details: { documentedItems: 95, undocumentedItems: [] },
          },
        },
        performance: {
          bundleSize: 350000, // Optimized bundle
          slowTests: [],
          bottlenecks: [],
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 92, // Excellent test coverage
            uncoveredBranches: [],
          },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: [],
        },
      };

      const candidates = analyzer.analyze(modernCodebaseAnalysis);

      // Should have very few or no issues
      expect(candidates.length).toBeLessThanOrEqual(1);

      if (candidates.length > 0) {
        // Any issues should be low priority
        candidates.forEach(candidate => {
          expect(['low', 'normal']).toContain(candidate.priority);
        });
      }
    });
  });

  describe('export verification', () => {
    it('should be properly exported from analyzer index', () => {
      // This test verifies the export is working by importing
      const { ConventionAnalyzer: ImportedAnalyzer } = require('./index');

      expect(ImportedAnalyzer).toBeDefined();
      expect(typeof ImportedAnalyzer).toBe('function');

      const instance = new ImportedAnalyzer();
      expect(instance).toBeInstanceOf(ConventionAnalyzer);
      expect(instance.type).toBe('conventions');
    });
  });
});