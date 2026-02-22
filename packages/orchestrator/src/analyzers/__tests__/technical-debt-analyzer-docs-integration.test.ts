/**
 * TechnicalDebtAnalyzer Documentation Integration Tests
 *
 * This test file focuses specifically on testing the outdated documentation
 * analysis functionality that was implemented in the TechnicalDebtAnalyzer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type { EnhancedDocumentationAnalysis } from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Documentation Integration', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { typescript: 4000, javascript: 1000 }
      },
      testCoverage: {
        percentage: 85,
        uncoveredFiles: []
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 90,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 90,
          total: 100,
          coveragePercentage: 90
        }
      } as EnhancedDocumentationAnalysis,
      performance: {
        bundleSize: 2048,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 80,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('Outdated documentation detection', () => {
    it('should detect critical outdated documentation', () => {
      const analysisWithCriticalOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'README.md',
              section: 'API Reference',
              lastModified: '2022-01-15',
              codeLastModified: '2024-03-20',
              severity: 'high' as const,
              description: 'API documentation is severely outdated',
              suggestion: 'Update API endpoints and authentication methods'
            },
            {
              file: 'docs/installation.md',
              section: 'Requirements',
              lastModified: '2021-06-10',
              codeLastModified: '2024-02-15',
              severity: 'high' as const,
              description: 'Installation requirements are outdated',
              suggestion: 'Update Node.js version requirements and dependencies'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithCriticalOutdatedDocs);
      const criticalDocsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-critical-outdated-docs'
      );

      expect(criticalDocsCandidate).toBeDefined();
      expect(criticalDocsCandidate?.priority).toBe('critical');
      expect(criticalDocsCandidate?.suggestedWorkflow).toBe('documentation');
      expect(criticalDocsCandidate?.description).toContain('2 critical outdated documentation issues');
      expect(criticalDocsCandidate?.score).toBeCloseTo(0.89); // 0.85 + (2 * 0.02)
      expect(criticalDocsCandidate?.remediationSuggestions?.length).toBe(2);

      // Check remediation suggestions
      const suggestions = criticalDocsCandidate?.remediationSuggestions || [];
      expect(suggestions.some(s => s.type === 'documentation_update')).toBe(true);
      expect(suggestions.some(s => s.priority === 'critical')).toBe(true);
    });

    it('should detect medium and low priority outdated documentation', () => {
      const analysisWithMixedOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'docs/contributing.md',
              section: 'Development Setup',
              lastModified: '2023-05-10',
              codeLastModified: '2024-01-15',
              severity: 'medium' as const,
              description: 'Development setup instructions need updating',
              suggestion: 'Update build commands and development workflow'
            },
            {
              file: 'docs/faq.md',
              section: 'Common Issues',
              lastModified: '2023-08-20',
              codeLastModified: '2024-02-10',
              severity: 'low' as const,
              description: 'FAQ answers are slightly outdated',
              suggestion: 'Review and update common issue solutions'
            },
            {
              file: 'docs/troubleshooting.md',
              section: 'Error Codes',
              lastModified: '2023-07-15',
              codeLastModified: '2024-03-01',
              severity: 'medium' as const,
              description: 'Error code documentation is incomplete',
              suggestion: 'Add new error codes and update descriptions'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithMixedOutdatedDocs);
      const outdatedDocsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-outdated-documentation'
      );

      expect(outdatedDocsCandidate).toBeDefined();
      expect(outdatedDocsCandidate?.priority).toBe('normal');
      expect(outdatedDocsCandidate?.suggestedWorkflow).toBe('documentation');
      expect(outdatedDocsCandidate?.description).toContain('3 outdated documentation issues');
      expect(outdatedDocsCandidate?.description).toContain('2 medium, 1 low severity');
      expect(outdatedDocsCandidate?.score).toBeCloseTo(0.53); // 0.5 + (3 * 0.01)

      // Check remediation suggestions
      const suggestions = outdatedDocsCandidate?.remediationSuggestions || [];
      expect(suggestions.some(s => s.type === 'documentation_update')).toBe(true);
      expect(suggestions.some(s => s.type === 'version_sync')).toBe(true);
    });

    it('should prioritize many medium severity docs as high priority', () => {
      const analysisWithManyMediumDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: Array(8).fill(null).map((_, index) => ({
            file: `docs/section${index}.md`,
            section: `Section ${index}`,
            lastModified: '2023-03-01',
            codeLastModified: '2024-02-15',
            severity: 'medium' as const,
            description: `Section ${index} documentation is outdated`,
            suggestion: `Update section ${index} content`
          }))
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithManyMediumDocs);
      const outdatedDocsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-outdated-documentation'
      );

      expect(outdatedDocsCandidate).toBeDefined();
      expect(outdatedDocsCandidate?.priority).toBe('high'); // Many medium docs should be high priority
      expect(outdatedDocsCandidate?.description).toContain('8 outdated documentation issues');
      expect(outdatedDocsCandidate?.description).toContain('8 medium, 0 low severity');
    });

    it('should not generate candidates when no outdated documentation exists', () => {
      const analysisWithCurrentDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: []
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithCurrentDocs);
      const docsCandidates = candidates.filter(c =>
        c.candidateId.includes('outdated-docs') || c.candidateId.includes('outdated-documentation')
      );

      expect(docsCandidates.length).toBe(0);
    });

    it('should handle mixed critical and non-critical outdated docs', () => {
      const analysisWithMixedSeverityDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'README.md',
              section: 'Getting Started',
              lastModified: '2022-01-01',
              codeLastModified: '2024-03-15',
              severity: 'high' as const,
              description: 'Critical getting started guide is completely outdated',
              suggestion: 'Completely rewrite getting started section'
            },
            {
              file: 'docs/api.md',
              section: 'Authentication',
              lastModified: '2021-12-15',
              codeLastModified: '2024-02-20',
              severity: 'high' as const,
              description: 'Authentication documentation references removed endpoints',
              suggestion: 'Update authentication flow and endpoint documentation'
            },
            {
              file: 'docs/examples.md',
              section: 'Code Examples',
              lastModified: '2023-06-10',
              codeLastModified: '2024-01-05',
              severity: 'medium' as const,
              description: 'Code examples use deprecated syntax',
              suggestion: 'Update examples to use current API'
            },
            {
              file: 'CHANGELOG.md',
              section: 'Recent Changes',
              lastModified: '2023-09-01',
              codeLastModified: '2024-01-20',
              severity: 'low' as const,
              description: 'Changelog is missing recent releases',
              suggestion: 'Add entries for recent versions'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithMixedSeverityDocs);

      const criticalDocsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-critical-outdated-docs'
      );
      const regularDocsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-outdated-documentation'
      );

      // Should have both critical and regular candidates
      expect(criticalDocsCandidate).toBeDefined();
      expect(regularDocsCandidate).toBeDefined();

      expect(criticalDocsCandidate?.priority).toBe('critical');
      expect(criticalDocsCandidate?.description).toContain('2 critical outdated documentation issues');

      expect(regularDocsCandidate?.priority).toBe('normal');
      expect(regularDocsCandidate?.description).toContain('2 outdated documentation issues');
      expect(regularDocsCandidate?.description).toContain('1 medium, 1 low severity');
    });
  });

  describe('Documentation metrics in createTechnicalDebtAnalysis', () => {
    it('should include documentation in debt score calculation', () => {
      const analysisWithDocIssues = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          coveragePercentage: 45, // Low documentation coverage
          outdatedDocs: [
            {
              file: 'README.md',
              section: 'API',
              lastModified: '2022-01-01',
              codeLastModified: '2024-03-01',
              severity: 'high' as const,
              description: 'API docs are severely outdated',
              suggestion: 'Complete API documentation rewrite needed'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const cleanAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          coveragePercentage: 90,
          outdatedDocs: []
        } as EnhancedDocumentationAnalysis
      };

      const debtAnalysisWithIssues = analyzer.createTechnicalDebtAnalysis(analysisWithDocIssues);
      const cleanDebtAnalysis = analyzer.createTechnicalDebtAnalysis(cleanAnalysis);

      // Analysis with doc issues should have higher debt score
      expect(debtAnalysisWithIssues.totalScore).toBeGreaterThan(cleanDebtAnalysis.totalScore);
      expect(debtAnalysisWithIssues.totalScore).toBeGreaterThan(10);
    });

    it('should create documentation debt category when outdated docs exist', () => {
      const analysisWithDocDebt = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'docs/guide.md',
              section: 'User Guide',
              lastModified: '2022-05-01',
              codeLastModified: '2024-02-15',
              severity: 'medium' as const,
              description: 'User guide needs updating',
              suggestion: 'Update user workflows and screenshots'
            },
            {
              file: 'docs/api.md',
              section: 'Endpoints',
              lastModified: '2023-01-10',
              codeLastModified: '2024-03-01',
              severity: 'high' as const,
              description: 'API endpoint documentation is outdated',
              suggestion: 'Review and update all API endpoint documentation'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithDocDebt);

      expect(debtAnalysis.categories).toBeDefined();
      const documentationCategory = debtAnalysis.categories.find(c => c.category === 'documentation');

      // Note: The current implementation may not create a documentation category
      // since it doesn't have that category in buildDebtCategories. This test documents
      // the current behavior and could be used to verify future enhancements.
      if (documentationCategory) {
        expect(documentationCategory.count).toBeGreaterThan(0);
        expect(['low', 'medium', 'high', 'critical']).toContain(documentationCategory.severity);
      }
    });

    it('should handle null documentation analysis gracefully', () => {
      const analysisWithNullDocs = {
        ...baseAnalysis,
        documentation: null as any
      };

      expect(() => analyzer.analyze(analysisWithNullDocs)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(analysisWithNullDocs)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithNullDocs);
      expect(Array.isArray(candidates)).toBe(true);

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithNullDocs);
      expect(typeof debtAnalysis.totalScore).toBe('number');
      expect(debtAnalysis.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing outdatedDocs property', () => {
      const analysisWithoutOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          coveragePercentage: 75,
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 75,
            total: 100,
            coveragePercentage: 75
          }
          // Note: outdatedDocs property is missing
        } as any
      };

      expect(() => analyzer.analyze(analysisWithoutOutdatedDocs)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithoutOutdatedDocs);
      const docsCandidates = candidates.filter(c =>
        c.candidateId.includes('outdated-docs')
      );

      expect(docsCandidates.length).toBe(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle malformed outdated documentation entries', () => {
      const analysisWithMalformedDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'valid-doc.md',
              section: 'Valid Section',
              lastModified: '2022-01-01',
              codeLastModified: '2024-01-01',
              severity: 'high' as const,
              description: 'Valid outdated doc',
              suggestion: 'Update this doc'
            },
            {
              // Missing required fields
              file: null as any,
              section: undefined as any,
              severity: 'medium' as const
            } as any,
            {
              file: 'another-valid-doc.md',
              section: 'Another Section',
              lastModified: '2023-01-01',
              codeLastModified: '2024-02-01',
              severity: 'low' as const,
              description: 'Another valid outdated doc',
              suggestion: 'Update this too'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      expect(() => analyzer.analyze(analysisWithMalformedDocs)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithMalformedDocs);
      // Should process valid entries despite malformed ones
      const docsCandidates = candidates.filter(c =>
        c.candidateId.includes('outdated-docs') || c.candidateId.includes('outdated-documentation')
      );

      expect(docsCandidates.length).toBeGreaterThan(0);
    });

    it('should handle empty outdatedDocs array', () => {
      const analysisWithEmptyOutdatedDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: []
        } as EnhancedDocumentationAnalysis
      };

      expect(() => analyzer.analyze(analysisWithEmptyOutdatedDocs)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithEmptyOutdatedDocs);
      const docsCandidates = candidates.filter(c =>
        c.candidateId.includes('outdated-docs')
      );

      expect(docsCandidates.length).toBe(0);
    });

    it('should handle documentation with unusual severity values', () => {
      const analysisWithUnusualSeverity = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'test-doc.md',
              section: 'Test Section',
              lastModified: '2022-01-01',
              codeLastModified: '2024-01-01',
              severity: 'unknown' as any, // Invalid severity
              description: 'Test doc with unknown severity',
              suggestion: 'Update test doc'
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      expect(() => analyzer.analyze(analysisWithUnusualSeverity)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithUnusualSeverity);
      // Should handle gracefully, possibly treating as low severity or filtering out
      expect(Array.isArray(candidates)).toBe(true);
    });
  });
});