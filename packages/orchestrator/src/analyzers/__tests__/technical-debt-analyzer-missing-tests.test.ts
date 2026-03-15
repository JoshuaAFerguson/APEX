/**
 * Technical Debt Analyzer - Missing Test Coverage Detection Tests
 *
 * Comprehensive tests for the missing test coverage detection functionality
 * that processes untestedExports and branchCoverage from testAnalysis,
 * maps to 'missing-tests' category with hotspots for untested files,
 * and integrates testCoverage metrics.
 *
 * Tests cover:
 * - processUntestedExports functionality
 * - processBranchCoverage functionality
 * - testAnalysis integration with task candidate generation
 * - hotspot creation for untested files
 * - testability category creation with testAnalysis data
 * - metrics integration with branch coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis
} from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Missing Test Coverage Detection', () => {
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
        percentage: 75,
        uncoveredFiles: ['legacy.ts']
      },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 10,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coveragePercentage: 80,
        undocumentedExports: [],
        outdatedDocumentation: [],
        missingReadmeSections: [],
        apiCompleteness: {
          documented: 80,
          total: 100,
          coveragePercentage: 80
        }
      } as EnhancedDocumentationAnalysis,
      performance: {
        bundleSize: 2048,
        slowTests: [],
        bottlenecks: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 85,
          uncoveredBranches: []
        },
        antiPatterns: [],
        untestedExports: []
      }
    };
  });

  describe('processUntestedExports', () => {
    it('should create critical priority task for untested public API exports', () => {
      const analysisWithUntestedApiExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'createUser',
              file: 'src/api/user.ts',
              isPublic: true,
              type: 'function',
              line: 15
            },
            {
              name: 'deleteUser',
              file: 'src/api/user.ts',
              isPublic: true,
              type: 'function',
              line: 45
            },
            {
              name: 'UserController',
              file: 'src/controllers/user.ts',
              isPublic: true,
              type: 'class',
              line: 10
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithUntestedApiExports);
      const apiTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );

      expect(apiTestingCandidate).toBeDefined();
      expect(apiTestingCandidate?.priority).toBe('critical');
      expect(apiTestingCandidate?.suggestedWorkflow).toBe('testing');
      expect(apiTestingCandidate?.title).toBe('Test Critical Public APIs');
      expect(apiTestingCandidate?.description).toContain('3 untested public API exports');
      expect(apiTestingCandidate?.description).toContain('Public APIs must be thoroughly tested');
      expect(apiTestingCandidate?.score).toBe(0.95);
      expect(apiTestingCandidate?.estimatedEffort).toBe('high');

      // Should have comprehensive remediation suggestions
      expect(apiTestingCandidate?.remediationSuggestions).toBeDefined();
      expect(apiTestingCandidate?.remediationSuggestions?.length).toBeGreaterThanOrEqual(2);

      const testingSuggestion = apiTestingCandidate?.remediationSuggestions?.find(s =>
        s.type === 'testing' && s.priority === 'critical'
      );
      expect(testingSuggestion).toBeDefined();
      expect(testingSuggestion?.description).toContain('comprehensive unit tests');
      expect(testingSuggestion?.expectedOutcome).toContain('reliable for consumers');
    });

    it('should create high priority task for untested public non-API exports', () => {
      const analysisWithUntestedPublicExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'validateEmail',
              file: 'src/utils/validation.ts',
              isPublic: true,
              type: 'function',
              line: 20
            },
            {
              name: 'formatDate',
              file: 'src/utils/date.ts',
              isPublic: true,
              type: 'function',
              line: 10
            },
            {
              name: 'Logger',
              file: 'src/utils/logger.ts',
              isPublic: true,
              type: 'class',
              line: 5
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithUntestedPublicExports);
      const publicTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );

      expect(publicTestingCandidate).toBeDefined();
      expect(publicTestingCandidate?.priority).toBe('high');
      expect(publicTestingCandidate?.suggestedWorkflow).toBe('testing');
      expect(publicTestingCandidate?.title).toBe('Test Public Utilities');
      expect(publicTestingCandidate?.description).toContain('3 untested public exports');
      expect(publicTestingCandidate?.score).toBe(0.8);
      expect(publicTestingCandidate?.estimatedEffort).toBe('medium');
    });

    it('should create normal/low priority task for many untested private exports', () => {
      const analysisWithManyPrivateExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: Array.from({ length: 25 }, (_, i) => ({
            name: `privateHelper${i}`,
            file: `src/internal/helpers${Math.floor(i / 5)}.ts`,
            isPublic: false,
            type: 'function' as const,
            line: 10 + (i * 5)
          }))
        }
      };

      const candidates = analyzer.analyze(analysisWithManyPrivateExports);
      const privateTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );

      expect(privateTestingCandidate).toBeDefined();
      expect(privateTestingCandidate?.priority).toBe('normal');
      expect(privateTestingCandidate?.suggestedWorkflow).toBe('testing');
      expect(privateTestingCandidate?.title).toBe('Improve Internal Test Coverage');
      expect(privateTestingCandidate?.description).toContain('25 untested internal exports');
      expect(privateTestingCandidate?.score).toBeCloseTo(0.55); // 0.3 + (25 * 0.01)
    });

    it('should not create task for small number of private untested exports', () => {
      const analysisWithFewPrivateExports = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'privateHelper',
              file: 'src/internal/helper.ts',
              isPublic: false,
              type: 'function',
              line: 15
            },
            {
              name: 'internalUtil',
              file: 'src/internal/util.ts',
              isPublic: false,
              type: 'function',
              line: 25
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithFewPrivateExports);
      const privateCandidates = candidates.filter(c =>
        c.candidateId.includes('test-coverage') || c.candidateId.includes('untested')
      );

      expect(privateCandidates.length).toBe(0);
    });

    it('should handle empty or undefined untested exports gracefully', () => {
      const analysisWithNoUntested = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: []
        }
      };

      const analysisWithUndefinedUntested = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: undefined as any
        }
      };

      expect(() => analyzer.analyze(analysisWithNoUntested)).not.toThrow();
      expect(() => analyzer.analyze(analysisWithUndefinedUntested)).not.toThrow();

      const candidates1 = analyzer.analyze(analysisWithNoUntested);
      const candidates2 = analyzer.analyze(analysisWithUndefinedUntested);

      const untestedCandidates1 = candidates1.filter(c => c.candidateId.includes('untested'));
      const untestedCandidates2 = candidates2.filter(c => c.candidateId.includes('untested'));

      expect(untestedCandidates1.length).toBe(0);
      expect(untestedCandidates2.length).toBe(0);
    });

    it('should correctly identify API files', () => {
      const analysisWithMixedFiles = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            // API files - should be treated as critical
            {
              name: 'getUsers',
              file: 'src/api/users.ts',
              isPublic: true,
              type: 'function',
              line: 10
            },
            {
              name: 'UserController',
              file: 'src/controllers/users.ts',
              isPublic: true,
              type: 'class',
              line: 5
            },
            {
              name: 'userRoutes',
              file: 'src/routes/users.ts',
              isPublic: true,
              type: 'function',
              line: 15
            },
            {
              name: 'userEndpoint',
              file: 'src/endpoints/users.ts',
              isPublic: true,
              type: 'function',
              line: 20
            },
            // Non-API files - should be treated as high priority
            {
              name: 'validateUser',
              file: 'src/utils/validation.ts',
              isPublic: true,
              type: 'function',
              line: 25
            }
          ]
        }
      };

      const candidates = analyzer.analyze(analysisWithMixedFiles);

      // Should have critical task for API exports
      const apiCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      expect(apiCandidate).toBeDefined();
      expect(apiCandidate?.description).toContain('4 untested public API exports');

      // Should have high priority task for non-API exports
      const nonApiCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );
      expect(nonApiCandidate).toBeDefined();
      expect(nonApiCandidate?.description).toContain('1 untested public exports');
    });
  });

  describe('processBranchCoverage', () => {
    it('should create critical priority task for very low branch coverage', () => {
      const analysisWithVeryLowBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 35,
            uncoveredBranches: [
              { file: 'src/auth.ts', line: 25, type: 'if', condition: 'user.isActive' },
              { file: 'src/auth.ts', line: 40, type: 'switch', condition: 'user.role' },
              { file: 'src/payment.ts', line: 15, type: 'if', condition: 'amount > 0' },
              { file: 'src/payment.ts', line: 30, type: 'try-catch', condition: 'payment validation' }
            ]
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithVeryLowBranchCoverage);
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('critical');
      expect(branchCoverageCandidate?.suggestedWorkflow).toBe('testing');
      expect(branchCoverageCandidate?.title).toBe('Improve Branch Coverage');
      expect(branchCoverageCandidate?.description).toContain('35%');
      expect(branchCoverageCandidate?.description).toContain('4 uncovered branches');
      expect(branchCoverageCandidate?.description).toContain('Target 80%+');
      expect(branchCoverageCandidate?.score).toBeCloseTo(0.65); // 1.0 - (35/100)
      expect(branchCoverageCandidate?.estimatedEffort).toBe('high');
    });

    it('should create high priority task for low branch coverage', () => {
      const analysisWithLowBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 55,
            uncoveredBranches: [
              { file: 'src/utils.ts', line: 10, type: 'if', condition: 'input validation' },
              { file: 'src/utils.ts', line: 25, type: 'if', condition: 'edge case' }
            ]
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithLowBranchCoverage);
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('high');
      expect(branchCoverageCandidate?.score).toBeCloseTo(0.45); // 1.0 - (55/100)
    });

    it('should not create task for good branch coverage', () => {
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

    it('should handle missing or undefined branch coverage', () => {
      const analysisWithNoBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: undefined as any
        }
      };

      expect(() => analyzer.analyze(analysisWithNoBranchCoverage)).not.toThrow();

      const candidates = analyzer.analyze(analysisWithNoBranchCoverage);
      const branchCandidates = candidates.filter(c => c.candidateId.includes('branch-coverage'));

      expect(branchCandidates.length).toBe(0);
    });

    it('should provide appropriate remediation suggestions for branch coverage', () => {
      const analysisWithLowBranchCoverage = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: [
              { file: 'src/logic.ts', line: 20, type: 'if', condition: 'error handling' }
            ]
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithLowBranchCoverage);
      const branchCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );

      expect(branchCandidate?.remediationSuggestions).toBeDefined();
      expect(branchCandidate?.remediationSuggestions?.length).toBeGreaterThanOrEqual(2);

      const branchTestSuggestion = branchCandidate?.remediationSuggestions?.find(s =>
        s.description.includes('conditional branches')
      );
      expect(branchTestSuggestion).toBeDefined();
      expect(branchTestSuggestion?.type).toBe('testing');
      expect(branchTestSuggestion?.expectedOutcome).toContain('branch coverage');

      const errorTestSuggestion = branchCandidate?.remediationSuggestions?.find(s =>
        s.description.includes('error paths')
      );
      expect(errorTestSuggestion).toBeDefined();
      expect(errorTestSuggestion?.type).toBe('testing');
    });
  });

  describe('testAnalysis integration with task candidates', () => {
    it('should handle analysis with both untested exports and low branch coverage', () => {
      const comprehensiveTestAnalysis = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'authenticate',
              file: 'src/api/auth.ts',
              isPublic: true,
              type: 'function',
              line: 10
            },
            {
              name: 'validateToken',
              file: 'src/utils/auth.ts',
              isPublic: true,
              type: 'function',
              line: 25
            }
          ],
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: [
              { file: 'src/api/auth.ts', line: 15, type: 'if', condition: 'token validation' },
              { file: 'src/utils/auth.ts', line: 30, type: 'switch', condition: 'user role' }
            ]
          }
        }
      };

      const candidates = analyzer.analyze(comprehensiveTestAnalysis);

      // Should have task for untested API exports
      const apiCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      expect(apiCandidate).toBeDefined();

      // Should have task for non-API exports
      const utilsCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );
      expect(utilsCandidate).toBeDefined();

      // Should have task for branch coverage
      const branchCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );
      expect(branchCandidate).toBeDefined();

      // Verify priorities are correct
      expect(apiCandidate?.priority).toBe('critical');
      expect(utilsCandidate?.priority).toBe('high');
      expect(branchCandidate?.priority).toBe('high');
    });

    it('should prioritize testAnalysis over legacy testCoverage', () => {
      const analysisWithBoth = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 40, // Would normally trigger test coverage task
          uncoveredFiles: ['legacy1.ts', 'legacy2.ts']
        },
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            {
              name: 'criticalFunction',
              file: 'src/api/critical.ts',
              isPublic: true,
              type: 'function',
              line: 10
            }
          ],
          branchCoverage: {
            percentage: 85, // Good coverage
            uncoveredBranches: []
          }
        }
      };

      const candidates = analyzer.analyze(analysisWithBoth);

      // Should have task for untested API export from testAnalysis
      const apiCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      expect(apiCandidate).toBeDefined();

      // Should also have legacy test coverage task due to low coverage
      const legacyCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      expect(legacyCandidate).toBeDefined();
    });

    it('should handle analysis with no testAnalysis gracefully', () => {
      const analysisWithoutTestAnalysis = {
        ...baseAnalysis,
        testAnalysis: undefined as any,
        testCoverage: {
          percentage: 50,
          uncoveredFiles: ['uncovered.ts']
        }
      };

      const candidates = analyzer.analyze(analysisWithoutTestAnalysis);

      // Should fallback to legacy test coverage
      const legacyCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      expect(legacyCandidate).toBeDefined();

      // Should not have testAnalysis-specific candidates
      const testAnalysisCandidates = candidates.filter(c =>
        c.candidateId.includes('untested-public-api') ||
        c.candidateId.includes('low-branch-coverage')
      );
      expect(testAnalysisCandidates.length).toBe(0);
    });
  });

  describe('Test coverage hotspots creation', () => {
    it('should create hotspots for files with many untested exports', () => {
      const analysisWithUntestedHotspots = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            // File with many untested exports should become a hotspot
            { name: 'func1', file: 'src/hotspot.ts', isPublic: true, type: 'function', line: 10 },
            { name: 'func2', file: 'src/hotspot.ts', isPublic: true, type: 'function', line: 20 },
            { name: 'func3', file: 'src/hotspot.ts', isPublic: false, type: 'function', line: 30 },
            { name: 'func4', file: 'src/hotspot.ts', isPublic: false, type: 'function', line: 40 },
            { name: 'func5', file: 'src/hotspot.ts', isPublic: false, type: 'function', line: 50 },

            // API file with public exports should be high score hotspot
            { name: 'createUser', file: 'src/api/users.ts', isPublic: true, type: 'function', line: 15 },
            { name: 'updateUser', file: 'src/api/users.ts', isPublic: true, type: 'function', line: 35 },

            // Single export shouldn't create hotspot
            { name: 'helper', file: 'src/utils/helper.ts', isPublic: false, type: 'function', line: 10 }
          ],
          branchCoverage: {
            percentage: 70,
            uncoveredBranches: [
              { file: 'src/hotspot.ts', line: 25, type: 'if', condition: 'validation' },
              { file: 'src/api/users.ts', line: 20, type: 'switch', condition: 'user type' }
            ]
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithUntestedHotspots);
      expect(analysis.hotspots.length).toBeGreaterThan(0);

      // Find hotspots for our test files
      const hotspotFile = analysis.hotspots.find(h => h.path === 'src/hotspot.ts');
      const apiFile = analysis.hotspots.find(h => h.path === 'src/api/users.ts');
      const helperFile = analysis.hotspots.find(h => h.path === 'src/utils/helper.ts');

      // src/hotspot.ts should be a hotspot (5 untested exports + 1 uncovered branch)
      expect(hotspotFile).toBeDefined();
      expect(hotspotFile?.score).toBeGreaterThan(20); // 5*5 + 1*2 = 27
      expect(hotspotFile?.issues).toContain('2 untested public exports');
      expect(hotspotFile?.issues).toContain('3 untested private exports');
      expect(hotspotFile?.issues).toContain('1 uncovered branches');

      // src/api/users.ts should be high score hotspot (API file + public exports)
      expect(apiFile).toBeDefined();
      expect(apiFile?.score).toBeGreaterThan(50); // 2*5 + 20 (public API penalty) + 30 (critical path penalty) + 1*2 = 62
      expect(apiFile?.issues).toContain('Critical API file without adequate test coverage');

      // src/utils/helper.ts should not be a hotspot (only 1 export, score too low)
      expect(helperFile).toBeUndefined();
    });

    it('should create hotspots for files with many uncovered branches only', () => {
      const analysisWithBranchHotspots = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [],
          branchCoverage: {
            percentage: 65,
            uncoveredBranches: [
              // File with many uncovered branches
              { file: 'src/complex.ts', line: 10, type: 'if', condition: 'condition1' },
              { file: 'src/complex.ts', line: 20, type: 'switch', condition: 'condition2' },
              { file: 'src/complex.ts', line: 30, type: 'if', condition: 'condition3' },
              { file: 'src/complex.ts', line: 40, type: 'try-catch', condition: 'error handling' },
              { file: 'src/complex.ts', line: 50, type: 'if', condition: 'condition4' },
              { file: 'src/complex.ts', line: 60, type: 'while', condition: 'loop condition' },

              // File with few uncovered branches - shouldn't be hotspot
              { file: 'src/simple.ts', line: 15, type: 'if', condition: 'simple check' }
            ]
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithBranchHotspots);

      const complexFile = analysis.hotspots.find(h => h.path === 'src/complex.ts');
      const simpleFile = analysis.hotspots.find(h => h.path === 'src/simple.ts');

      // src/complex.ts should be a hotspot (6 branches * 3 = 18 score)
      expect(complexFile).toBeDefined();
      expect(complexFile?.score).toBe(18);
      expect(complexFile?.issues).toContain('6 uncovered branches');
      expect(complexFile?.issues).toContain('Uncovered if, switch, try-catch, while conditions');

      // src/simple.ts should not be hotspot (only 1 branch, below threshold of 5)
      expect(simpleFile).toBeUndefined();
    });

    it('should combine untested exports and branch coverage in hotspot scoring', () => {
      const analysisWithCombinedHotspots = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            { name: 'processData', file: 'src/processor.ts', isPublic: true, type: 'function', line: 10 },
            { name: 'helperMethod', file: 'src/processor.ts', isPublic: false, type: 'function', line: 50 }
          ],
          branchCoverage: {
            percentage: 70,
            uncoveredBranches: [
              { file: 'src/processor.ts', line: 15, type: 'if', condition: 'data validation' },
              { file: 'src/processor.ts', line: 25, type: 'switch', condition: 'data type' },
              { file: 'src/processor.ts', line: 55, type: 'if', condition: 'helper condition' }
            ]
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithCombinedHotspots);

      const processorFile = analysis.hotspots.find(h => h.path === 'src/processor.ts');

      expect(processorFile).toBeDefined();
      // Score: 2 untested exports * 5 + 3 uncovered branches * 2 = 16
      expect(processorFile?.score).toBe(16);
      expect(processorFile?.issues).toContain('1 untested public exports');
      expect(processorFile?.issues).toContain('1 untested private exports');
      expect(processorFile?.issues).toContain('3 uncovered branches');
    });
  });

  describe('Testability category creation with testAnalysis', () => {
    it('should create testability category with critical severity for untested API exports', () => {
      const analysisWithCriticalTestability = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [
            { name: 'createOrder', file: 'src/api/orders.ts', isPublic: true, type: 'function', line: 10 },
            { name: 'cancelOrder', file: 'src/api/orders.ts', isPublic: true, type: 'function', line: 50 }
          ],
          branchCoverage: {
            percentage: 30,
            uncoveredBranches: Array.from({ length: 8 }, (_, i) => ({
              file: 'src/orders.ts',
              line: 10 + (i * 5),
              type: 'if' as const,
              condition: `condition ${i + 1}`
            }))
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithCriticalTestability);
      const testabilityCategory = analysis.categories.find(c => c.category === 'testability');

      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.severity).toBe('critical');
      expect(testabilityCategory?.count).toBe(10); // 2 untested exports + 8 uncovered branches
      expect(testabilityCategory?.examples).toContain('2 untested public API exports');
      expect(testabilityCategory?.examples).toContain('30% branch coverage (critical)');
      expect(testabilityCategory?.estimatedEffort).toBe('1-2 weeks');
    });

    it('should create testability category with high severity for significant issues', () => {
      const analysisWithHighTestability = {
        ...baseAnalysis,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: Array.from({ length: 8 }, (_, i) => ({
            name: `utilFunction${i}`,
            file: `src/utils/util${Math.floor(i / 3)}.ts`,
            isPublic: true,
            type: 'function' as const,
            line: 10 + (i * 5)
          })),
          branchCoverage: {
            percentage: 55,
            uncoveredBranches: Array.from({ length: 5 }, (_, i) => ({
              file: 'src/utils.ts',
              line: 20 + (i * 10),
              type: 'if' as const,
              condition: `utility condition ${i + 1}`
            }))
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithHighTestability);
      const testabilityCategory = analysis.categories.find(c => c.category === 'testability');

      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.severity).toBe('high');
      expect(testabilityCategory?.count).toBe(13); // 8 exports + 5 branches
      expect(testabilityCategory?.examples).toContain('8 untested public exports');
      expect(testabilityCategory?.examples).toContain('55% branch coverage');
      expect(testabilityCategory?.estimatedEffort).toBe('1 week');
    });

    it('should fallback to legacy testCoverage when testAnalysis is incomplete', () => {
      const analysisWithLegacyCoverage = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 45,
          uncoveredFiles: ['file1.ts', 'file2.ts', 'file3.ts']
        },
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [],
          branchCoverage: {
            percentage: 85, // Good branch coverage
            uncoveredBranches: []
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithLegacyCoverage);
      const testabilityCategory = analysis.categories.find(c => c.category === 'testability');

      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.count).toBe(3); // 3 uncovered files
      expect(testabilityCategory?.severity).toBe('high');
      expect(testabilityCategory?.examples).toContain('45% test coverage');
      expect(testabilityCategory?.estimatedEffort).toBe('1-2 weeks');
    });

    it('should return null when there are no testability issues', () => {
      const analysisWithGoodTestability = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 85,
          uncoveredFiles: []
        },
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          untestedExports: [],
          branchCoverage: {
            percentage: 85,
            uncoveredBranches: []
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithGoodTestability);
      const testabilityCategory = analysis.categories.find(c => c.category === 'testability');

      expect(testabilityCategory).toBeUndefined();
    });
  });

  describe('Metrics integration with testAnalysis', () => {
    it('should prioritize testAnalysis branchCoverage over legacy testCoverage in metrics', () => {
      const analysisWithBothCoverageTypes = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 60, // Legacy coverage
          uncoveredFiles: ['legacy.ts']
        },
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: {
            percentage: 75, // Should take precedence
            uncoveredBranches: []
          }
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithBothCoverageTypes);

      expect(analysis.metrics?.testCoverage).toBe(75);
    });

    it('should fallback to legacy testCoverage when testAnalysis branchCoverage is unavailable', () => {
      const analysisWithLegacyOnly = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 50,
          uncoveredFiles: ['file.ts']
        },
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: undefined as any
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithLegacyOnly);

      expect(analysis.metrics?.testCoverage).toBe(50);
    });

    it('should handle undefined testCoverage gracefully', () => {
      const analysisWithNoTestCoverage = {
        ...baseAnalysis,
        testCoverage: undefined as any,
        testAnalysis: {
          ...baseAnalysis.testAnalysis,
          branchCoverage: undefined as any
        }
      };

      const analysis = analyzer.createTechnicalDebtAnalysis(analysisWithNoTestCoverage);

      expect(analysis.metrics?.testCoverage).toBeUndefined();
    });
  });

  describe('Integration tests', () => {
    it('should handle comprehensive testAnalysis data correctly', () => {
      const comprehensiveAnalysis = {
        ...baseAnalysis,
        testCoverage: {
          percentage: 40, // Legacy fallback
          uncoveredFiles: ['legacy.ts']
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: [
              { file: 'src/critical.ts', line: 10, type: 'if' as const, condition: 'auth check' },
              { file: 'src/critical.ts', line: 25, type: 'switch' as const, condition: 'role check' },
              { file: 'src/payment.ts', line: 15, type: 'try-catch' as const, condition: 'payment' }
            ]
          },
          untestedExports: [
            // Critical API exports
            { name: 'authenticateUser', file: 'src/api/auth.ts', isPublic: true, type: 'function', line: 20 },
            { name: 'processPayment', file: 'src/api/payment.ts', isPublic: true, type: 'function', line: 30 },

            // Public utilities
            { name: 'validateInput', file: 'src/utils/validation.ts', isPublic: true, type: 'function', line: 10 },
            { name: 'formatCurrency', file: 'src/utils/format.ts', isPublic: true, type: 'function', line: 15 },

            // Private helpers (many)
            ...Array.from({ length: 15 }, (_, i) => ({
              name: `privateHelper${i}`,
              file: `src/internal/helpers.ts`,
              isPublic: false,
              type: 'function' as const,
              line: 50 + (i * 3)
            }))
          ],
          antiPatterns: []
        }
      };

      const candidates = analyzer.analyze(comprehensiveAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Should have multiple task candidates
      expect(candidates.length).toBeGreaterThan(3);

      // Should have critical API testing task
      const apiTask = candidates.find(c => c.candidateId === 'technical-debt-untested-public-api');
      expect(apiTask).toBeDefined();
      expect(apiTask?.priority).toBe('critical');

      // Should have high priority public utilities task
      const utilsTask = candidates.find(c => c.candidateId === 'technical-debt-untested-exports');
      expect(utilsTask).toBeDefined();
      expect(utilsTask?.priority).toBe('high');

      // Should have normal priority internal testing task
      const internalTask = candidates.find(c => c.candidateId === 'technical-debt-test-coverage');
      expect(internalTask).toBeDefined();
      expect(internalTask?.priority).toBe('normal');

      // Should have high priority branch coverage task
      const branchTask = candidates.find(c => c.candidateId === 'technical-debt-low-branch-coverage');
      expect(branchTask).toBeDefined();
      expect(branchTask?.priority).toBe('high');

      // Should have legacy test coverage task
      const legacyTask = candidates.find(c => c.candidateId === 'technical-debt-test-coverage');
      expect(legacyTask).toBeDefined();

      // Debt analysis should have testability category
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.severity).toBe('critical'); // Due to API exports
      expect(testabilityCategory?.count).toBe(25); // 22 exports + 3 branches

      // Should have hotspots for files with many issues
      expect(debtAnalysis.hotspots.length).toBeGreaterThan(0);
      const apiHotspot = debtAnalysis.hotspots.find(h => h.path === 'src/api/auth.ts');
      expect(apiHotspot).toBeDefined();

      // Should prioritize testAnalysis in metrics
      expect(debtAnalysis.metrics?.testCoverage).toBe(45); // From branchCoverage, not legacy
    });
  });
});