/**
 * Technical Debt Analyzer - TODO/FIXME/HACK Comment Detection Tests
 *
 * Tests for the deprecated code detection through stale-reference TODO comments
 * from documentation analysis. Tests the analyzeTodoComments method that processes
 * outdatedDocs from documentation analysis and maps stale-reference types to
 * the appropriate technical debt categories with proper hotspot creation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TechnicalDebtAnalyzer - TODO/FIXME/HACK Comment Detection', () => {
  let analyzer: TechnicalDebtAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();

    baseAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { typescript: 8000, javascript: 2000 }
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
        },
        outdatedDocs: []
      },
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

  describe('analyzeTodoComments - Stale Reference Detection', () => {
    it('should detect stale TODO comments and create appropriate candidates', () => {
      const analysisWithStaleComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/utils.ts',
              type: 'stale-reference',
              description: 'TODO: Refactor this utility function to use async/await',
              line: 25,
              severity: 'medium'
            },
            {
              file: 'src/api.ts',
              type: 'stale-reference',
              description: 'TODO: Add proper error handling for API calls',
              line: 105,
              severity: 'low'
            },
            {
              file: 'src/components/Header.tsx',
              type: 'stale-reference',
              description: 'TODO: Replace deprecated componentWillMount lifecycle method',
              line: 42,
              severity: 'high'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithStaleComments);
      const todoCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(todoCandidate).toBeDefined();
      expect(todoCandidate?.title).toBe('Address Stale TODO/FIXME/HACK Comments');
      expect(todoCandidate?.description).toContain('3 stale comments');
      expect(todoCandidate?.description).toContain('3 TODO');
      expect(todoCandidate?.description).toContain('0 FIXME');
      expect(todoCandidate?.description).toContain('0 HACK');
      expect(todoCandidate?.description).toContain('1 are high severity');
      expect(todoCandidate?.suggestedWorkflow).toBe('maintenance');
      expect(todoCandidate?.rationale).toContain('Stale TODO/FIXME/HACK comments represent accumulated technical debt');
    });

    it('should detect and categorize FIXME comments with critical priority', () => {
      const analysisWithFixmeComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/auth.ts',
              type: 'stale-reference',
              description: 'FIXME: Security vulnerability in password validation',
              line: 78,
              severity: 'high'
            },
            {
              file: 'src/database.ts',
              type: 'stale-reference',
              description: 'FIXME: Memory leak in connection pooling',
              line: 156,
              severity: 'high'
            },
            {
              file: 'src/utils.ts',
              type: 'stale-reference',
              description: 'TODO: Add logging to this function',
              line: 23,
              severity: 'low'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithFixmeComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();
      expect(staleCandidate?.priority).toBe('high'); // High severity comments present
      expect(staleCandidate?.description).toContain('2 FIXME');
      expect(staleCandidate?.description).toContain('1 TODO');
      expect(staleCandidate?.description).toContain('2 are high severity');

      // Should have FIXME-specific remediation
      const fixmeRemediation = staleCandidate?.remediationSuggestions?.find(s =>
        s.description.includes('FIXME')
      );
      expect(fixmeRemediation).toBeDefined();
      expect(fixmeRemediation?.type).toBe('manual_review');
      expect(fixmeRemediation?.priority).toBe('critical');
      expect(fixmeRemediation?.description).toContain('2 FIXME comments - these indicate known bugs');
    });

    it('should detect and categorize HACK comments with high priority', () => {
      const analysisWithHackComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/components/Modal.tsx',
              type: 'stale-reference',
              description: 'HACK: Workaround for React portal timing issue',
              line: 45,
              severity: 'medium'
            },
            {
              file: 'src/services/api.ts',
              type: 'stale-reference',
              description: 'HACK: Temporary fix for CORS issues in development',
              line: 89,
              severity: 'medium'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithHackComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();
      expect(staleCandidate?.description).toContain('2 HACK');
      expect(staleCandidate?.priority).toBe('normal'); // Medium severity = normal priority

      // Should have HACK-specific remediation
      const hackRemediation = staleCandidate?.remediationSuggestions?.find(s =>
        s.description.includes('HACK')
      );
      expect(hackRemediation).toBeDefined();
      expect(hackRemediation?.type).toBe('manual_review');
      expect(hackRemediation?.priority).toBe('high');
      expect(hackRemediation?.description).toContain('2 HACK comments - these indicate technical shortcuts');
    });

    it('should categorize mixed comment types and assign appropriate priority', () => {
      const analysisWithMixedComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/critical.ts',
              type: 'stale-reference',
              description: 'FIXME: This function crashes on edge case input',
              line: 12,
              severity: 'high'
            },
            {
              file: 'src/workaround.ts',
              type: 'stale-reference',
              description: 'HACK: Quick fix for production issue, needs proper solution',
              line: 67,
              severity: 'medium'
            },
            {
              file: 'src/feature.ts',
              type: 'stale-reference',
              description: 'TODO: Implement proper caching mechanism',
              line: 144,
              severity: 'low'
            },
            {
              file: 'src/legacy.ts',
              type: 'stale-reference',
              description: 'TODO: Migrate to new API when available',
              line: 89,
              severity: 'medium'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMixedComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();
      expect(staleCandidate?.priority).toBe('high'); // Due to high severity FIXME
      expect(staleCandidate?.description).toContain('4 stale comments');
      expect(staleCandidate?.description).toContain('2 TODO');
      expect(staleCandidate?.description).toContain('1 FIXME');
      expect(staleCandidate?.description).toContain('1 HACK');
      expect(staleCandidate?.description).toContain('1 are high severity');

      // Should have all three types of remediation suggestions
      expect(staleCandidate?.remediationSuggestions).toHaveLength(3);

      const fixmeRemediation = staleCandidate?.remediationSuggestions?.find(s => s.description.includes('FIXME'));
      expect(fixmeRemediation?.priority).toBe('critical');

      const hackRemediation = staleCandidate?.remediationSuggestions?.find(s => s.description.includes('HACK'));
      expect(hackRemediation?.priority).toBe('high');

      const todoRemediation = staleCandidate?.remediationSuggestions?.find(s => s.description.includes('TODO'));
      expect(todoRemediation?.priority).toBe('medium');
    });

    it('should assign correct effort levels based on comment count', () => {
      const analysisWithManyComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: Array(25).fill(null).map((_, index) => ({
            file: `src/file${index}.ts`,
            type: 'stale-reference' as const,
            description: 'TODO: Refactor this code',
            line: 10,
            severity: 'low' as const
          }))
        }
      };

      const candidates = analyzer.analyze(analysisWithManyComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();
      expect(staleCandidate?.estimatedEffort).toBe('high'); // > 20 comments
      expect(staleCandidate?.description).toContain('25 stale comments');
    });

    it('should calculate appropriate scores based on count and severity', () => {
      const analysisWithScoredComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            // 2 high severity (critical) comments - should add 2 * 0.05 = 0.1 to score
            {
              file: 'src/critical1.ts',
              type: 'stale-reference',
              description: 'FIXME: Critical bug here',
              line: 10,
              severity: 'high'
            },
            {
              file: 'src/critical2.ts',
              type: 'stale-reference',
              description: 'FIXME: Another critical issue',
              line: 15,
              severity: 'high'
            },
            // 3 normal comments - should add base score calculation
            {
              file: 'src/normal1.ts',
              type: 'stale-reference',
              description: 'TODO: Normal task',
              line: 20,
              severity: 'medium'
            },
            {
              file: 'src/normal2.ts',
              type: 'stale-reference',
              description: 'TODO: Another normal task',
              line: 25,
              severity: 'low'
            },
            {
              file: 'src/normal3.ts',
              type: 'stale-reference',
              description: 'TODO: Third normal task',
              line: 30,
              severity: 'low'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithScoredComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();

      // Score formula: 0.5 + Math.min(0.4, staleComments.length * 0.02) + (criticalCount * 0.05)
      // = 0.5 + Math.min(0.4, 5 * 0.02) + (2 * 0.05) = 0.5 + 0.1 + 0.1 = 0.7
      expect(staleCandidate?.score).toBeCloseTo(0.7, 1);
    });

    it('should not create candidates for non-stale-reference outdated docs', () => {
      const analysisWithNonStaleComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'README.md',
              type: 'version-mismatch',
              description: 'Documentation references outdated API version',
              line: 25,
              severity: 'high'
            },
            {
              file: 'docs/api.md',
              type: 'broken-link',
              description: 'Link to deprecated documentation site',
              line: 105,
              severity: 'medium'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithNonStaleComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeUndefined();
    });

    it('should not create candidates when no stale-reference comments exist', () => {
      const candidates = analyzer.analyze(baseAnalysis);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeUndefined();
    });

    it('should handle empty outdatedDocs array gracefully', () => {
      const analysisWithEmptyOutdated: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: []
        }
      };

      expect(() => analyzer.analyze(analysisWithEmptyOutdated)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithEmptyOutdated);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeUndefined();
    });
  });

  describe('Integration with TechnicalDebtAnalysis', () => {
    it('should contribute to technical debt score when TODO comments are present', () => {
      const analysisWithTodos: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/component.ts',
              type: 'stale-reference',
              description: 'TODO: Optimize this algorithm',
              line: 45,
              severity: 'medium'
            }
          ]
        }
      };

      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithTodos);

      // Should contribute to documentation category score through outdated docs
      expect(technicalDebtAnalysis.totalScore).toBeGreaterThan(0);
    });

    it('should create documentation hotspots for files with many stale comments', () => {
      const analysisWithManyTodosInFile: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/legacy-component.ts',
              type: 'stale-reference',
              description: 'TODO: Refactor this component',
              line: 10,
              severity: 'high'
            },
            {
              file: 'src/legacy-component.ts',
              type: 'stale-reference',
              description: 'FIXME: Fix memory leak here',
              line: 45,
              severity: 'high'
            },
            {
              file: 'src/legacy-component.ts',
              type: 'stale-reference',
              description: 'HACK: Temporary workaround',
              line: 78,
              severity: 'medium'
            }
          ]
        }
      };

      const technicalDebtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithManyTodosInFile);

      // Should create hotspot for the file with multiple stale references
      const hotspot = technicalDebtAnalysis.hotspots.find(h => h.path === 'src/legacy-component.ts');
      expect(hotspot).toBeDefined();
      expect(hotspot?.score).toBeGreaterThan(20); // Should be significant
      expect(hotspot?.issues).toContain('2 critical outdated documentation issues');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle comments without specific TODO/FIXME/HACK keywords', () => {
      const analysisWithGenericStaleComments: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/generic.ts',
              type: 'stale-reference',
              description: 'This code needs to be updated for the new API',
              line: 25,
              severity: 'medium'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithGenericStaleComments);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();
      expect(staleCandidate?.description).toContain('1 stale comments');
      expect(staleCandidate?.description).toContain('0 TODO, 0 FIXME, 0 HACK');

      // Should still create candidate but without specific keyword remediation
      expect(staleCandidate?.remediationSuggestions).toHaveLength(0);
    });

    it('should handle missing severity gracefully', () => {
      const analysisWithMissingSeverity: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/missing-severity.ts',
              type: 'stale-reference',
              description: 'TODO: Add proper error handling',
              line: 25,
              severity: undefined as any
            }
          ]
        }
      };

      expect(() => analyzer.analyze(analysisWithMissingSeverity)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithMissingSeverity);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeDefined();
      // Should default to low priority when severity is missing/undefined
      expect(staleCandidate?.priority).toBe('low');
    });

    it('should handle null/undefined outdatedDocs gracefully', () => {
      const analysisWithNullOutdatedDocs: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: {
          ...baseAnalysis.documentation,
          outdatedDocs: undefined as any
        }
      };

      expect(() => analyzer.analyze(analysisWithNullOutdatedDocs)).not.toThrow();
      const candidates = analyzer.analyze(analysisWithNullOutdatedDocs);
      const staleCandidate = candidates.find(c => c.candidateId === 'technical-debt-stale-comments');

      expect(staleCandidate).toBeUndefined();
    });

    it('should handle missing documentation object gracefully', () => {
      const analysisWithoutDocumentation: ProjectAnalysis = {
        ...baseAnalysis,
        documentation: undefined as any
      };

      expect(() => analyzer.analyze(analysisWithoutDocumentation)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(analysisWithoutDocumentation)).not.toThrow();
    });
  });
});