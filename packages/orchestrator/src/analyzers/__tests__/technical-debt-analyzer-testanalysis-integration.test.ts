/**
 * TechnicalDebtAnalyzer TestAnalysis Integration Tests
 *
 * This test file focuses specifically on testing the integration with the enhanced
 * testAnalysis data structure including untested exports and branch coverage analysis.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type { EnhancedDocumentationAnalysis } from '@apexcli/core';

describe('TechnicalDebtAnalyzer - TestAnalysis Integration', () => {
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

  describe('Untested exports analysis', () => {
    it('should detect untested public API exports and create critical task candidates', () => {
      const analysisWithUntestedApiExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'getUserById',
              file: 'src/api/users.ts',
              line: 15,
              isPublic: true,
              type: 'function',
              complexity: 'medium'
            },
            {
              name: 'UserController',
              file: 'src/controllers/user.ts',
              line: 20,
              isPublic: true,
              type: 'class',
              complexity: 'high'
            },
            {
              name: 'validateRequest',
              file: 'src/routes/middleware.ts',
              line: 8,
              isPublic: true,
              type: 'function',
              complexity: 'low'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithUntestedApiExports);
      const apiTestCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );

      expect(apiTestCandidate).toBeDefined();
      expect(apiTestCandidate?.priority).toBe('critical');
      expect(apiTestCandidate?.suggestedWorkflow).toBe('testing');
      expect(apiTestCandidate?.description).toContain('3 untested public API exports');
      expect(apiTestCandidate?.score).toBe(0.95);
      expect(apiTestCandidate?.remediationSuggestions?.length).toBeGreaterThan(0);
    });

    it('should detect untested public non-API exports with high priority', () => {
      const analysisWithUntestedPublicExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'formatDate',
              file: 'src/utils/date.ts',
              line: 10,
              isPublic: true,
              type: 'function',
              complexity: 'low'
            },
            {
              name: 'Logger',
              file: 'src/utils/logger.ts',
              line: 25,
              isPublic: true,
              type: 'class',
              complexity: 'medium'
            },
            {
              name: 'ValidationHelper',
              file: 'src/helpers/validation.ts',
              line: 5,
              isPublic: true,
              type: 'class',
              complexity: 'high'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithUntestedPublicExports);
      const publicExportsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );

      expect(publicExportsCandidate).toBeDefined();
      expect(publicExportsCandidate?.priority).toBe('high');
      expect(publicExportsCandidate?.suggestedWorkflow).toBe('testing');
      expect(publicExportsCandidate?.description).toContain('3 untested public exports');
      expect(publicExportsCandidate?.score).toBe(0.8);
    });

    it('should detect many untested private exports with appropriate priority', () => {
      const analysisWithManyPrivateExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: Array(25).fill(null).map((_, index) => ({
            name: `privateFunction${index}`,
            file: `src/internal/module${index % 5}.ts`,
            line: 10 + index,
            isPublic: false,
            type: 'function',
            complexity: 'medium'
          }))
        }
      };

      const candidates = analyzer.analyze(analysisWithManyPrivateExports);
      const testCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );

      expect(testCoverageCandidate).toBeDefined();
      expect(testCoverageCandidate?.priority).toBe('normal');
      expect(testCoverageCandidate?.suggestedWorkflow).toBe('testing');
      expect(testCoverageCandidate?.description).toContain('25 untested internal exports');
      expect(testCoverageCandidate?.score).toBeCloseTo(0.55); // 0.3 + (25 * 0.01)
    });

    it('should not generate candidates for few private exports', () => {
      const analysisWithFewPrivateExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: Array(5).fill(null).map((_, index) => ({
            name: `privateHelper${index}`,
            file: `src/helpers/helper${index}.ts`,
            line: 15,
            isPublic: false,
            type: 'function',
            complexity: 'low'
          }))
        }
      };

      const candidates = analyzer.analyze(analysisWithFewPrivateExports);
      const testCoverageCandidates = candidates.filter(c =>
        c.candidateId.includes('test-coverage') || c.candidateId.includes('untested')
      );

      expect(testCoverageCandidates.length).toBe(0);
    });
  });

  describe('Branch coverage analysis', () => {
    it('should detect critical low branch coverage', () => {
      const analysisWithCriticalBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 25,
            uncoveredBranches: [
              {
                file: 'src/auth/validator.ts',
                line: 45,
                type: 'if' as const,
                description: 'Authentication check'
              },
              {
                file: 'src/auth/validator.ts',
                line: 52,
                type: 'else' as const,
                description: 'Auth failure handling'
              },
              {
                file: 'src/payment/processor.ts',
                line: 33,
                type: 'catch' as const,
                description: 'Payment error handling'
              }
            ]
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithCriticalBranchCoverage);
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('critical');
      expect(branchCoverageCandidate?.suggestedWorkflow).toBe('testing');
      expect(branchCoverageCandidate?.description).toContain('Branch coverage is 25%');
      expect(branchCoverageCandidate?.description).toContain('3 uncovered branches');
      expect(branchCoverageCandidate?.score).toBe(0.75); // 1.0 - (25/100)
    });

    it('should detect high priority low branch coverage', () => {
      const analysisWithHighPriorityBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 55,
            uncoveredBranches: [
              {
                file: 'src/utils/validation.ts',
                line: 20,
                type: 'if' as const,
                description: 'Input validation check'
              },
              {
                file: 'src/utils/validation.ts',
                line: 28,
                type: 'ternary' as const,
                description: 'Default value assignment'
              }
            ]
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithHighPriorityBranchCoverage);
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('high');
      expect(branchCoverageCandidate?.description).toContain('Branch coverage is 55%');
      expect(branchCoverageCandidate?.score).toBe(0.45); // 1.0 - (55/100)
    });

    it('should not generate candidates for good branch coverage', () => {
      const analysisWithGoodBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 85,
            uncoveredBranches: []
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithGoodBranchCoverage);
      const branchCoverageCandidates = candidates.filter(c =>
        c.candidateId.includes('branch-coverage')
      );

      expect(branchCoverageCandidates.length).toBe(0);
    });
  });

  describe('Combined testAnalysis scenarios', () => {
    it('should handle both untested exports and low branch coverage', () => {
      const analysisWithBothIssues = {
        ...baseAnalysis,
        testAnalysis: {
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: [
              {
                file: 'src/services/auth.ts',
                line: 15,
                type: 'if' as const,
                description: 'Token validation'
              },
              {
                file: 'src/services/auth.ts',
                line: 25,
                type: 'catch' as const,
                description: 'Auth error handling'
              }
            ]
          },
          antiPatterns: [],
          untestedExports: [
            {
              name: 'AuthService',
              file: 'src/services/auth.ts',
              line: 5,
              isPublic: true,
              type: 'class',
              complexity: 'high'
            },
            {
              name: 'validateToken',
              file: 'src/api/auth.ts',
              line: 12,
              isPublic: true,
              type: 'function',
              complexity: 'medium'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithBothIssues);

      const untestedApiCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(untestedApiCandidate).toBeDefined();
      expect(untestedApiCandidate?.priority).toBe('critical');

      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('high');

      // Both should have testing workflow
      expect(untestedApiCandidate?.suggestedWorkflow).toBe('testing');
      expect(branchCoverageCandidate?.suggestedWorkflow).toBe('testing');
    });

    it('should prioritize critical API issues over branch coverage', () => {
      const analysisWithPriorityConflict = {
        ...baseAnalysis,
        testAnalysis: {
          branchCoverage: {
            percentage: 30,
            uncoveredBranches: Array(10).fill({
              file: 'src/utils/helpers.ts',
              line: 10,
              type: 'if' as const,
              description: 'Helper condition'
            })
          },
          antiPatterns: [],
          untestedExports: [
            {
              name: 'createUser',
              file: 'src/api/users.ts',
              line: 20,
              isPublic: true,
              type: 'function',
              complexity: 'high'
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithPriorityConflict);

      // API issue should have highest score despite lower count
      const untestedApiCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(untestedApiCandidate?.score).toBe(0.95);
      expect(branchCoverageCandidate?.score).toBe(0.7); // 1.0 - (30/100)
      expect(untestedApiCandidate?.score).toBeGreaterThan(branchCoverageCandidate?.score);
    });
  });

  describe('createTechnicalDebtAnalysis with testAnalysis', () => {
    it('should incorporate testAnalysis data into debt categories', () => {
      const analysisWithTestIssues = {
        ...baseAnalysis,
        testAnalysis: {
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: [
              { file: 'src/app.ts', line: 10, type: 'if' as const, description: 'Main condition' },
              { file: 'src/app.ts', line: 15, type: 'else' as const, description: 'Error path' }
            ]
          },
          antiPatterns: [],
          untestedExports: [
            {
              name: 'publicFunction',
              file: 'src/utils/public.ts',
              line: 8,
              isPublic: true,
              type: 'function',
              complexity: 'medium'
            },
            {
              name: 'privateHelper',
              file: 'src/utils/private.ts',
              line: 12,
              isPublic: false,
              type: 'function',
              complexity: 'low'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithTestIssues);

      expect(debtAnalysis.categories).toBeDefined();
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');

      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.count).toBe(4); // 2 uncovered branches + 2 untested exports
      expect(testabilityCategory?.severity).toBe('high'); // Should be high due to branch coverage < 60%
      expect(testabilityCategory?.examples).toContain('45% branch coverage');
      expect(testabilityCategory?.examples).toContain('1 untested public exports');
    });

    it('should build test coverage hotspots from testAnalysis', () => {
      const analysisWithTestHotspots = {
        ...baseAnalysis,
        testAnalysis: {
          branchCoverage: {
            percentage: 65,
            uncoveredBranches: [
              { file: 'src/critical/auth.ts', line: 20, type: 'if' as const, description: 'Auth check' },
              { file: 'src/critical/auth.ts', line: 25, type: 'catch' as const, description: 'Error handling' },
              { file: 'src/critical/auth.ts', line: 30, type: 'else' as const, description: 'Fallback' },
              { file: 'src/critical/auth.ts', line: 35, type: 'switch' as const, description: 'Role check' },
              { file: 'src/critical/auth.ts', line: 40, type: 'ternary' as const, description: 'Permission' }
            ]
          },
          antiPatterns: [],
          untestedExports: [
            {
              name: 'AuthController',
              file: 'src/critical/auth.ts',
              line: 5,
              isPublic: true,
              type: 'class',
              complexity: 'high'
            },
            {
              name: 'validateAuth',
              file: 'src/api/auth.ts',
              line: 15,
              isPublic: true,
              type: 'function',
              complexity: 'medium'
            }
          ]
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithTestHotspots);

      expect(debtAnalysis.hotspots).toBeDefined();
      const authHotspot = debtAnalysis.hotspots.find(h => h.path === 'src/critical/auth.ts');

      expect(authHotspot).toBeDefined();
      expect(authHotspot?.score).toBeGreaterThan(20); // Should have significant score
      expect(authHotspot?.issues).toContain('1 untested public exports');
      expect(authHotspot?.issues).toContain('5 uncovered branches');
      expect(authHotspot?.issues).toContain('Critical API file without adequate test coverage');
    });

    it('should calculate metrics with testAnalysis branch coverage', () => {
      const analysisWithTestMetrics = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 70, // Legacy test coverage
          uncoveredFiles: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 55, // Better branch coverage should override legacy
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: []
        }
      };

      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(analysisWithTestMetrics);

      expect(debtAnalysis.metrics?.testCoverage).toBe(55); // Should use testAnalysis branch coverage
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThan(0);
    });
  });

  describe('Error handling and edge cases with testAnalysis', () => {
    it('should handle null testAnalysis gracefully', () => {
      const analysisWithNullTestAnalysis = {
        ...baseAnalysis,
        testAnalysis: null as any
      };

      expect(() => analyzer.analyze(analysisWithNullTestAnalysis)).not.toThrow();
      expect(() => analyzer.createTechnicalDebtAnalysis(analysisWithNullTestAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithNullTestAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should handle partial testAnalysis data', () => {
      const analysisWithPartialTestAnalysis = {
        ...baseAnalysis,
        testAnalysis: {
          branchCoverage: null as any,
          antiPatterns: [],
          untestedExports: null as any
        }
      };

      expect(() => analyzer.analyze(analysisWithPartialTestAnalysis)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithPartialTestAnalysis);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should handle empty uncoveredBranches array', () => {
      const analysisWithEmptyBranches = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 30,
            uncoveredBranches: []
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithEmptyBranches);
      const branchCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(branchCandidate).toBeDefined();
      expect(branchCandidate?.description).toContain('0 uncovered branches');
    });

    it('should handle malformed untested export objects', () => {
      const analysisWithMalformedExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'validExport',
              file: 'src/valid.ts',
              line: 10,
              isPublic: true,
              type: 'function',
              complexity: 'low'
            },
            {
              // Missing required fields
              name: null as any,
              file: undefined as any,
              isPublic: true
            } as any,
            {
              name: 'anotherValidExport',
              file: 'src/another.ts',
              line: 20,
              isPublic: false,
              type: 'class',
              complexity: 'high'
            }
          ]
        }
      };

      expect(() => analyzer.analyze(analysisWithMalformedExports)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithMalformedExports);
      // Should still process valid exports
      expect(candidates.length).toBeGreaterThan(0);
    });
  });
});