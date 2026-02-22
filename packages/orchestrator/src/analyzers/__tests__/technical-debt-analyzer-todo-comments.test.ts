/**
 * Technical Debt Analyzer TODO/FIXME/HACK Comments Test
 *
 * This test file focuses specifically on testing the analysis of TODO, FIXME,
 * and HACK comments detected through documentation analysis stale-reference types.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type { EnhancedDocumentationAnalysis } from '@apexcli/core';

describe('TechnicalDebtAnalyzer - TODO/FIXME/HACK Comments', () => {
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

  describe('FIXME comment detection', () => {
    it('should detect critical FIXME comments and assign high priority', () => {
      const analysisWithFixmeComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/auth/login.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Authentication bypass vulnerability in login logic (added 120 days ago)',
              line: 45,
              severity: 'high' as const
            },
            {
              file: 'src/payment/processor.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Race condition in payment processing (added 95 days ago)',
              line: 78,
              severity: 'high' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithFixmeComments);
      const fixmeCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(fixmeCandidate).toBeDefined();
      expect(fixmeCandidate?.priority).toBe('high'); // High due to 2 critical (>90 days) FIXME comments
      expect(fixmeCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(fixmeCandidate?.description).toContain('2 stale comments');
      expect(fixmeCandidate?.description).toContain('0 TODO');
      expect(fixmeCandidate?.description).toContain('2 FIXME');
      expect(fixmeCandidate?.description).toContain('0 HACK');
      expect(fixmeCandidate?.description).toContain('2 are high severity');

      // Should have FIXME-specific remediation
      const fixmeRemediation = fixmeCandidate?.remediationSuggestions?.find(r =>
        r.description.includes('FIXME') && r.priority === 'critical'
      );
      expect(fixmeRemediation).toBeDefined();
      expect(fixmeRemediation?.type).toBe('manual_review');
      expect(fixmeRemediation?.expectedOutcome).toContain('Resolved bugs');
    });

    it('should assign appropriate score for FIXME comments based on age', () => {
      const analysisWithAgedFixmeComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/utils/helpers.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Memory leak in caching logic (added 45 days ago)',
              line: 25,
              severity: 'medium' as const // Medium severity (< 90 days)
            },
            {
              file: 'src/api/endpoints.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Error handling incomplete (added 10 days ago)',
              line: 102,
              severity: 'low' as const // Low severity (< 30 days)
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithAgedFixmeComments);
      const fixmeCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(fixmeCandidate).toBeDefined();
      expect(fixmeCandidate?.priority).toBe('normal'); // Normal due to medium severity being highest
      expect(fixmeCandidate?.score).toBeCloseTo(0.5 + (2 * 0.02), 2); // Base + count penalty
    });
  });

  describe('HACK comment detection', () => {
    it('should detect HACK comments and assign high priority remediation', () => {
      const analysisWithHackComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/data/storage.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Using global variable to share state between modules (added 60 days ago)',
              line: 15,
              severity: 'medium' as const
            },
            {
              file: 'src/ui/components.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Monkey-patching third-party library for compatibility (added 30 days ago)',
              line: 88,
              severity: 'low' as const
            },
            {
              file: 'src/network/client.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Hardcoded timeout to work around API issue (added 100 days ago)',
              line: 45,
              severity: 'high' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithHackComments);
      const hackCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(hackCandidate).toBeDefined();
      expect(hackCandidate?.priority).toBe('high'); // High due to one high-severity HACK
      expect(hackCandidate?.description).toContain('3 stale comments');
      expect(hackCandidate?.description).toContain('0 TODO');
      expect(hackCandidate?.description).toContain('0 FIXME');
      expect(hackCandidate?.description).toContain('3 HACK');
      expect(hackCandidate?.description).toContain('1 are high severity');

      // Should have HACK-specific remediation
      const hackRemediation = hackCandidate?.remediationSuggestions?.find(r =>
        r.description.includes('HACK') && r.priority === 'high'
      );
      expect(hackRemediation).toBeDefined();
      expect(hackRemediation?.type).toBe('manual_review');
      expect(hackRemediation?.expectedOutcome).toContain('Cleaner, more maintainable code');
    });
  });

  describe('TODO comment detection', () => {
    it('should detect TODO comments and assign medium priority remediation', () => {
      const analysisWithTodoComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/features/search.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Implement fuzzy search algorithm (added 75 days ago)',
              line: 120,
              severity: 'medium' as const
            },
            {
              file: 'src/ui/dashboard.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Add loading states for async operations (added 40 days ago)',
              line: 65,
              severity: 'medium' as const
            },
            {
              file: 'src/utils/validation.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Localize error messages (added 15 days ago)',
              line: 33,
              severity: 'low' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithTodoComments);
      const todoCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(todoCandidate).toBeDefined();
      expect(todoCandidate?.priority).toBe('normal'); // Normal due to medium being highest severity
      expect(todoCandidate?.description).toContain('3 stale comments');
      expect(todoCandidate?.description).toContain('3 TODO');
      expect(todoCandidate?.description).toContain('0 FIXME');
      expect(todoCandidate?.description).toContain('0 HACK');
      expect(todoCandidate?.description).toContain('2 are medium');

      // Should have TODO-specific remediation
      const todoRemediation = todoCandidate?.remediationSuggestions?.find(r =>
        r.description.includes('TODO') && r.priority === 'medium'
      );
      expect(todoRemediation).toBeDefined();
      expect(todoRemediation?.type).toBe('manual_review');
      expect(todoRemediation?.expectedOutcome).toContain('Completed features');
    });
  });

  describe('Mixed comment types', () => {
    it('should handle mixed TODO/FIXME/HACK comments with correct prioritization', () => {
      const analysisWithMixedComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            // FIXME comments (highest priority)
            {
              file: 'src/core/engine.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Critical bug in state management (added 110 days ago)',
              line: 89,
              severity: 'high' as const
            },
            {
              file: 'src/api/auth.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Session timeout not working correctly (added 95 days ago)',
              line: 156,
              severity: 'high' as const
            },
            // HACK comments (high priority)
            {
              file: 'src/lib/polyfills.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Browser compatibility workaround (added 80 days ago)',
              line: 23,
              severity: 'medium' as const
            },
            {
              file: 'src/services/legacy.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Temporary fix for legacy API integration (added 65 days ago)',
              line: 44,
              severity: 'medium' as const
            },
            // TODO comments (medium priority)
            {
              file: 'src/ui/components.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Implement accessibility features (added 50 days ago)',
              line: 200,
              severity: 'medium' as const
            },
            {
              file: 'src/features/export.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Add CSV export functionality (added 30 days ago)',
              line: 75,
              severity: 'low' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithMixedComments);
      const mixedCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(mixedCandidate).toBeDefined();
      expect(mixedCandidate?.priority).toBe('high'); // High due to critical FIXME comments
      expect(mixedCandidate?.description).toContain('6 stale comments');
      expect(mixedCandidate?.description).toContain('2 TODO');
      expect(mixedCandidate?.description).toContain('2 FIXME');
      expect(mixedCandidate?.description).toContain('2 HACK');
      expect(mixedCandidate?.description).toContain('2 are high severity');

      // Should have all three types of remediation suggestions
      const remediationTypes = mixedCandidate?.remediationSuggestions?.map(r => r.description) || [];
      expect(remediationTypes.some(desc => desc.includes('FIXME'))).toBe(true);
      expect(remediationTypes.some(desc => desc.includes('HACK'))).toBe(true);
      expect(remediationTypes.some(desc => desc.includes('TODO'))).toBe(true);

      // FIXME should be listed first (critical priority)
      const firstRemediation = mixedCandidate?.remediationSuggestions?.[0];
      expect(firstRemediation?.priority).toBe('critical');
      expect(firstRemediation?.description).toContain('FIXME');
    });

    it('should calculate appropriate score for mixed comments with severity weighting', () => {
      const analysisWithScoredComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            // 3 high severity (critical aged comments)
            {
              file: 'src/critical1.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Critical issue 1 (added 100 days ago)',
              severity: 'high' as const
            },
            {
              file: 'src/critical2.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Critical issue 2 (added 105 days ago)',
              severity: 'high' as const
            },
            {
              file: 'src/critical3.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Critical hack (added 120 days ago)',
              severity: 'high' as const
            },
            // 2 medium severity
            {
              file: 'src/medium1.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Medium task 1 (added 60 days ago)',
              severity: 'medium' as const
            },
            {
              file: 'src/medium2.ts',
              type: 'stale-reference' as const,
              description: 'HACK: Medium hack (added 70 days ago)',
              severity: 'medium' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithScoredComments);
      const scoredCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(scoredCandidate).toBeDefined();

      // Score formula: 0.5 + Math.min(0.4, count * 0.02) + (criticalCount * 0.05)
      // Expected: 0.5 + Math.min(0.4, 5 * 0.02) + (3 * 0.05) = 0.5 + 0.1 + 0.15 = 0.75
      const expectedScore = 0.5 + Math.min(0.4, 5 * 0.02) + (3 * 0.05);
      expect(scoredCandidate?.score).toBeCloseTo(expectedScore, 2);
      expect(scoredCandidate?.effort).toBe('medium'); // 5 comments: low < 10 < medium < 20 < high
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle no stale-reference comments gracefully', () => {
      const analysisWithoutStaleComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch' as const,
              description: 'Documentation references old version',
              severity: 'medium' as const
            },
            {
              file: 'API.md',
              type: 'broken-link' as const,
              description: 'Broken external link',
              severity: 'low' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithoutStaleComments);
      const staleCommentsCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCommentsCandidate).toBeUndefined(); // No stale comments = no candidate
    });

    it('should handle malformed stale-reference descriptions gracefully', () => {
      const analysisWithMalformedComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/valid.ts',
              type: 'stale-reference' as const,
              description: 'TODO: Valid comment with proper format',
              severity: 'low' as const
            },
            {
              file: 'src/malformed.ts',
              type: 'stale-reference' as const,
              description: 'This does not contain any TODO/FIXME/HACK keywords',
              severity: 'medium' as const
            },
            {
              file: 'src/empty.ts',
              type: 'stale-reference' as const,
              description: '',
              severity: 'high' as const
            },
            {
              file: 'src/another-valid.ts',
              type: 'stale-reference' as const,
              description: 'FIXME: Another valid comment',
              severity: 'medium' as const
            }
          ]
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithMalformedComments);
      const commentsCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(commentsCandidate).toBeDefined();
      // Should only count valid TODO/FIXME/HACK comments (2 out of 4)
      expect(commentsCandidate?.description).toContain('2 stale comments');
      expect(commentsCandidate?.description).toContain('1 TODO');
      expect(commentsCandidate?.description).toContain('1 FIXME');
      expect(commentsCandidate?.description).toContain('0 HACK');
    });

    it('should handle empty or null outdated docs array', () => {
      const analysisWithEmptyDocs = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: []
        } as EnhancedDocumentationAnalysis
      };

      expect(() => analyzer.analyze(analysisWithEmptyDocs)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithEmptyDocs);
      const staleCommentsCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCommentsCandidate).toBeUndefined();
    });

    it('should handle missing documentation section', () => {
      const analysisWithoutDocs = {
        ...baseAnalysis,
        documentation: null as any
      };

      expect(() => analyzer.analyze(analysisWithoutDocs)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithoutDocs);
      const staleCommentsCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCommentsCandidate).toBeUndefined();
    });
  });

  describe('Effort estimation', () => {
    it('should assign low effort for few comments', () => {
      const analysisWithFewComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: Array(5).fill(null).map((_, i) => ({
            file: `src/file${i}.ts`,
            type: 'stale-reference' as const,
            description: `TODO: Task ${i}`,
            severity: 'low' as const
          }))
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithFewComments);
      const candidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(candidate?.effort).toBe('low'); // ≤ 10 comments
    });

    it('should assign medium effort for moderate comments', () => {
      const analysisWithMediumComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: Array(15).fill(null).map((_, i) => ({
            file: `src/file${i}.ts`,
            type: 'stale-reference' as const,
            description: `TODO: Task ${i}`,
            severity: 'medium' as const
          }))
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithMediumComments);
      const candidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(candidate?.effort).toBe('medium'); // > 10 && ≤ 20 comments
    });

    it('should assign high effort for many comments', () => {
      const analysisWithManyComments = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: Array(25).fill(null).map((_, i) => ({
            file: `src/file${i}.ts`,
            type: 'stale-reference' as const,
            description: `HACK: Workaround ${i}`,
            severity: 'high' as const
          }))
        } as EnhancedDocumentationAnalysis
      };

      const candidates = analyzer.analyze(analysisWithManyComments);
      const candidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(candidate?.effort).toBe('high'); // > 20 comments
    });
  });
});