/**
 * Technical Debt Analyzer - Missing Test Coverage End-to-End Integration Test
 *
 * This test file provides comprehensive end-to-end validation of the missing test coverage
 * detection feature. It simulates realistic project scenarios and validates that the
 * analyzer properly processes untestedExports and branchCoverage from testAnalysis,
 * maps to 'testability' category with hotspots for untested files,
 * and integrates testCoverage metrics correctly.
 *
 * This test complements the existing unit and integration tests by providing
 * realistic scenario validation and ensuring the feature works end-to-end.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis,
  TechnicalDebtAnalysis
} from '@apexcli/core';

describe('TechnicalDebtAnalyzer - Missing Test Coverage E2E Integration', () => {
  let analyzer: TechnicalDebtAnalyzer;

  beforeEach(() => {
    analyzer = new TechnicalDebtAnalyzer();
  });

  describe('Realistic API Project Scenario', () => {
    it('should handle a comprehensive API project with mixed test coverage issues', () => {
      // Simulate a realistic e-commerce API project with various test coverage issues
      const realisticApiProjectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 150,
          lines: 25000,
          languages: { typescript: 20000, javascript: 5000 }
        },
        testCoverage: {
          percentage: 65, // Moderate overall coverage
          uncoveredFiles: ['legacy-utils.ts', 'deprecated-helpers.ts']
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [
            {
              name: 'express',
              currentVersion: '4.18.0',
              latestVersion: '4.18.2',
              updateType: 'patch' as const
            }
          ],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 15,
          duplicatedCode: [
            {
              pattern: 'input validation logic',
              locations: ['src/controllers/users.ts', 'src/controllers/orders.ts', 'src/controllers/products.ts'],
              similarity: 0.92
            }
          ],
          complexityHotspots: [
            {
              file: 'src/services/payment-processor.ts',
              cyclomaticComplexity: 25,
              cognitiveComplexity: 30,
              lineCount: 350,
              functionName: 'processPayment'
            }
          ],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 75,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 75,
            total: 100,
            coveragePercentage: 75
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 4096,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          // Realistic branch coverage with specific problem areas
          branchCoverage: {
            percentage: 58, // Below target of 80%
            uncoveredBranches: [
              // Payment processing - critical path
              { file: 'src/services/payment-processor.ts', line: 45, type: 'if', condition: 'payment.amount > creditLimit' },
              { file: 'src/services/payment-processor.ts', line: 67, type: 'switch', condition: 'payment.currency' },
              { file: 'src/services/payment-processor.ts', line: 89, type: 'try-catch', condition: 'external API call' },

              // Authentication - critical security path
              { file: 'src/middleware/auth.ts', line: 25, type: 'if', condition: 'token.isExpired()' },
              { file: 'src/middleware/auth.ts', line: 32, type: 'if', condition: 'user.permissions.includes(permission)' },

              // Order processing - business logic
              { file: 'src/services/order-service.ts', line: 112, type: 'if', condition: 'inventory.quantity >= order.quantity' },
              { file: 'src/services/order-service.ts', line: 134, type: 'switch', condition: 'order.status' },

              // Email service - non-critical
              { file: 'src/services/email-service.ts', line: 78, type: 'if', condition: 'template.isActive' },
            ]
          },
          antiPatterns: [],
          untestedExports: [
            // Critical API endpoints - highest priority
            {
              name: 'processPayment',
              file: 'src/api/payments.ts',
              isPublic: true,
              type: 'function',
              line: 15
            },
            {
              name: 'createOrder',
              file: 'src/api/orders.ts',
              isPublic: true,
              type: 'function',
              line: 20
            },
            {
              name: 'PaymentController',
              file: 'src/controllers/payment.ts',
              isPublic: true,
              type: 'class',
              line: 8
            },
            {
              name: 'OrderController',
              file: 'src/controllers/order.ts',
              isPublic: true,
              type: 'class',
              line: 12
            },

            // Public utilities - high priority
            {
              name: 'validatePaymentData',
              file: 'src/utils/payment-validation.ts',
              isPublic: true,
              type: 'function',
              line: 25
            },
            {
              name: 'formatCurrency',
              file: 'src/utils/currency.ts',
              isPublic: true,
              type: 'function',
              line: 10
            },
            {
              name: 'EmailNotificationService',
              file: 'src/services/notifications.ts',
              isPublic: true,
              type: 'class',
              line: 30
            },

            // Private helpers - lower priority but many of them
            ...Array.from({ length: 18 }, (_, i) => ({
              name: `helperFunction${i}`,
              file: `src/internal/helpers-${Math.floor(i / 6)}.ts`,
              isPublic: false,
              type: 'function' as const,
              line: 15 + (i * 3)
            }))
          ]
        }
      };

      // Run analysis
      const candidates = analyzer.analyze(realisticApiProjectAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(realisticApiProjectAnalysis);

      // Validate task candidates are generated
      expect(candidates.length).toBeGreaterThan(3);

      // Should have critical task for untested API endpoints
      const apiTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      expect(apiTestingCandidate).toBeDefined();
      expect(apiTestingCandidate?.priority).toBe('critical');
      expect(apiTestingCandidate?.suggestedWorkflow).toBe('testing');
      expect(apiTestingCandidate?.description).toContain('4 untested public API exports');
      expect(apiTestingCandidate?.score).toBe(0.95);

      // Should have high priority task for public utilities
      const utilsTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );
      expect(utilsTestingCandidate).toBeDefined();
      expect(utilsTestingCandidate?.priority).toBe('high');
      expect(utilsTestingCandidate?.description).toContain('3 untested public exports');
      expect(utilsTestingCandidate?.score).toBe(0.8);

      // Should have normal priority task for private exports
      const privateTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      expect(privateTestingCandidate).toBeDefined();
      expect(privateTestingCandidate?.priority).toBe('normal');
      expect(privateTestingCandidate?.description).toContain('18 untested internal exports');

      // Should have high priority task for branch coverage
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );
      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('high');
      expect(branchCoverageCandidate?.description).toContain('Branch coverage is 58%');
      expect(branchCoverageCandidate?.description).toContain('8 uncovered branches');

      // Validate TechnicalDebtAnalysis structure
      expect(debtAnalysis).toBeDefined();
      expect(debtAnalysis.totalScore).toBeGreaterThan(30); // Should have significant debt
      expect(debtAnalysis.totalScore).toBeLessThan(70); // But not extreme

      // Should have testability category
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.severity).toBe('critical'); // Due to API exports
      expect(testabilityCategory?.count).toBe(33); // 25 exports + 8 branches
      expect(testabilityCategory?.examples).toEqual(
        expect.arrayContaining([
          expect.stringContaining('untested public API exports'),
          expect.stringContaining('58% branch coverage')
        ])
      );

      // Should have hotspots for critical files
      expect(debtAnalysis.hotspots.length).toBeGreaterThan(3);

      // Payment processor should be a major hotspot (API + branches + complexity)
      const paymentHotspot = debtAnalysis.hotspots.find(h =>
        h.path === 'src/services/payment-processor.ts'
      );
      expect(paymentHotspot).toBeDefined();
      expect(paymentHotspot?.score).toBeGreaterThan(50); // Should be high due to multiple issues

      // API files should be hotspots
      const apiHotspots = debtAnalysis.hotspots.filter(h =>
        h.path.includes('/api/') || h.path.includes('/controllers/')
      );
      expect(apiHotspots.length).toBeGreaterThan(2);

      // Validate metrics integration
      expect(debtAnalysis.metrics?.testCoverage).toBe(58); // Should use testAnalysis branch coverage
      expect(debtAnalysis.metrics?.codeComplexity).toBe(25); // From complexity hotspot
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThan(40);
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeLessThan(70);
    });
  });

  describe('Frontend React Project Scenario', () => {
    it('should handle a React frontend project with component testing gaps', () => {
      const reactProjectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 80,
          lines: 12000,
          languages: { typescript: 8000, javascript: 4000 }
        },
        testCoverage: {
          percentage: 70,
          uncoveredFiles: ['src/legacy-component.tsx']
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 8,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 85,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 85,
            total: 100,
            coveragePercentage: 85
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 3072,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 72,
            uncoveredBranches: [
              // React component conditional rendering
              { file: 'src/components/UserProfile.tsx', line: 45, type: 'if', condition: 'user.isLoggedIn' },
              { file: 'src/components/UserProfile.tsx', line: 52, type: 'ternary', condition: 'user.avatar ? avatar : defaultAvatar' },

              // Form validation
              { file: 'src/components/ContactForm.tsx', line: 78, type: 'if', condition: 'formData.email.includes("@")' },

              // Error boundaries
              { file: 'src/components/ErrorBoundary.tsx', line: 25, type: 'catch', condition: 'component error handling' },
            ]
          },
          antiPatterns: [],
          untestedExports: [
            // Custom hooks - should be tested
            {
              name: 'useAuthentication',
              file: 'src/hooks/useAuthentication.ts',
              isPublic: true,
              type: 'function',
              line: 15
            },
            {
              name: 'useUserProfile',
              file: 'src/hooks/useUserProfile.ts',
              isPublic: true,
              type: 'function',
              line: 8
            },

            // Utility components
            {
              name: 'LoadingSpinner',
              file: 'src/components/LoadingSpinner.tsx',
              isPublic: true,
              type: 'function',
              line: 12
            },
            {
              name: 'ErrorMessage',
              file: 'src/components/ErrorMessage.tsx',
              isPublic: true,
              type: 'function',
              line: 5
            },

            // Utils
            {
              name: 'formatUserName',
              file: 'src/utils/userUtils.ts',
              isPublic: true,
              type: 'function',
              line: 20
            },

            // Private helpers - few
            {
              name: 'validateInputs',
              file: 'src/internal/validation.ts',
              isPublic: false,
              type: 'function',
              line: 35
            }
          ]
        }
      };

      const candidates = analyzer.analyze(reactProjectAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(reactProjectAnalysis);

      // Should have high priority task for public utilities (hooks, components, utils)
      const publicTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );
      expect(publicTestingCandidate).toBeDefined();
      expect(publicTestingCandidate?.priority).toBe('high');
      expect(publicTestingCandidate?.description).toContain('5 untested public exports');

      // Should NOT have private exports task (only 1 private export, below threshold)
      const privateTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      expect(privateTestingCandidate).toBeUndefined();

      // Should NOT have branch coverage task (72% is above 70%, not triggering)
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );
      expect(branchCoverageCandidate).toBeUndefined();

      // Testability category should reflect moderate issues
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.severity).toBe('high'); // Due to 5 public exports
      expect(testabilityCategory?.count).toBe(10); // 6 exports + 4 branches
      expect(testabilityCategory?.estimatedEffort).toBe('3-5 days');

      // Should use testAnalysis branch coverage in metrics
      expect(debtAnalysis.metrics?.testCoverage).toBe(72);
    });
  });

  describe('Legacy Project Migration Scenario', () => {
    it('should handle legacy project with extensive testing debt', () => {
      const legacyProjectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 200,
          lines: 50000,
          languages: { javascript: 35000, typescript: 15000 }
        },
        testCoverage: {
          percentage: 25, // Very low legacy coverage
          uncoveredFiles: Array.from({ length: 50 }, (_, i) => `legacy-file-${i}.js`)
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 150,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 30,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 30,
            total: 100,
            coveragePercentage: 30
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 8192,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 15, // Critical branch coverage
            uncoveredBranches: Array.from({ length: 45 }, (_, i) => ({
              file: `src/legacy/module-${Math.floor(i / 5)}.js`,
              line: 20 + (i * 2),
              type: 'if' as const,
              condition: `legacy condition ${i + 1}`
            }))
          },
          antiPatterns: [],
          untestedExports: [
            // Many legacy API functions
            ...Array.from({ length: 15 }, (_, i) => ({
              name: `legacyApiFunction${i}`,
              file: `src/api/legacy-api-${Math.floor(i / 5)}.js`,
              isPublic: true,
              type: 'function' as const,
              line: 25 + (i * 5)
            })),

            // Many legacy utilities
            ...Array.from({ length: 25 }, (_, i) => ({
              name: `legacyUtil${i}`,
              file: `src/utils/legacy-utils-${Math.floor(i / 8)}.js`,
              isPublic: true,
              type: 'function' as const,
              line: 30 + (i * 3)
            })),

            // Massive number of private functions
            ...Array.from({ length: 85 }, (_, i) => ({
              name: `legacyPrivate${i}`,
              file: `src/legacy/internal-${Math.floor(i / 10)}.js`,
              isPublic: false,
              type: 'function' as const,
              line: 50 + (i * 2)
            }))
          ]
        }
      };

      const candidates = analyzer.analyze(legacyProjectAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(legacyProjectAnalysis);

      // Should have critical task for API functions
      const apiTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-public-api'
      );
      expect(apiTestingCandidate).toBeDefined();
      expect(apiTestingCandidate?.priority).toBe('critical');
      expect(apiTestingCandidate?.description).toContain('15 untested public API exports');

      // Should have high priority task for utilities
      const utilsTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-untested-exports'
      );
      expect(utilsTestingCandidate).toBeDefined();
      expect(utilsTestingCandidate?.priority).toBe('high');
      expect(utilsTestingCandidate?.description).toContain('25 untested public exports');

      // Should have normal priority task for private functions
      const privateTestingCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      expect(privateTestingCandidate).toBeDefined();
      expect(privateTestingCandidate?.priority).toBe('normal');
      expect(privateTestingCandidate?.description).toContain('85 untested internal exports');

      // Should have critical branch coverage task
      const branchCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-low-branch-coverage'
      );
      expect(branchCoverageCandidate).toBeDefined();
      expect(branchCoverageCandidate?.priority).toBe('critical');
      expect(branchCoverageCandidate?.description).toContain('15%');
      expect(branchCoverageCandidate?.score).toBe(0.85); // 1.0 - (15/100)

      // Testability category should be critical
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.severity).toBe('critical');
      expect(testabilityCategory?.count).toBe(170); // 125 exports + 45 branches
      expect(testabilityCategory?.estimatedEffort).toBe('1-2 weeks');

      // Should have very high total debt score
      expect(debtAnalysis.totalScore).toBeGreaterThan(60);

      // Should have many hotspots
      expect(debtAnalysis.hotspots.length).toBeGreaterThanOrEqual(10);

      // Should use critical branch coverage in metrics
      expect(debtAnalysis.metrics?.testCoverage).toBe(15);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle perfect test coverage gracefully', () => {
      const perfectProjectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 50,
          lines: 8000,
          languages: { typescript: 8000 }
        },
        testCoverage: {
          percentage: 100,
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
          coveragePercentage: 100,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 100,
            total: 100,
            coveragePercentage: 100
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 2048,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 100, // Perfect coverage
            uncoveredBranches: []
          },
          antiPatterns: [],
          untestedExports: [] // All exports tested
        }
      };

      const candidates = analyzer.analyze(perfectProjectAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(perfectProjectAnalysis);

      // Should have no test coverage related candidates
      const testCandidates = candidates.filter(c =>
        c.candidateId.includes('untested') ||
        c.candidateId.includes('branch-coverage') ||
        c.candidateId.includes('test-coverage')
      );
      expect(testCandidates.length).toBe(0);

      // Should not have testability category
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeUndefined();

      // Should have very low total debt score
      expect(debtAnalysis.totalScore).toBeLessThan(5);

      // Should use perfect coverage in metrics
      expect(debtAnalysis.metrics?.testCoverage).toBe(100);
      expect(debtAnalysis.metrics?.maintainabilityIndex).toBeGreaterThan(90);
    });

    it('should handle missing testAnalysis data and fallback to legacy coverage', () => {
      const legacyOnlyAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 40,
          lines: 6000,
          languages: { typescript: 6000 }
        },
        testCoverage: {
          percentage: 45, // Should trigger legacy test coverage task
          uncoveredFiles: ['file1.ts', 'file2.ts', 'file3.ts']
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 5,
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
          bundleSize: 1024,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: undefined as any // Missing testAnalysis
      };

      const candidates = analyzer.analyze(legacyOnlyAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(legacyOnlyAnalysis);

      // Should have legacy test coverage task
      const legacyCoverageCandidate = candidates.find(c =>
        c.candidateId === 'technical-debt-test-coverage'
      );
      expect(legacyCoverageCandidate).toBeDefined();
      expect(legacyCoverageCandidate?.priority).toBe('high'); // 45% < 60%
      expect(legacyCoverageCandidate?.description).toContain('45%');

      // Should NOT have testAnalysis-specific candidates
      const testAnalysisCandidates = candidates.filter(c =>
        c.candidateId.includes('untested-public-api') ||
        c.candidateId.includes('untested-exports') ||
        c.candidateId.includes('low-branch-coverage')
      );
      expect(testAnalysisCandidates.length).toBe(0);

      // Should have testability category from legacy data
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.count).toBe(3); // uncoveredFiles.length
      expect(testabilityCategory?.examples).toContain('45% test coverage');

      // Should use legacy coverage in metrics
      expect(debtAnalysis.metrics?.testCoverage).toBe(45);
    });
  });

  describe('Feature Validation', () => {
    it('should validate all acceptance criteria are met', () => {
      const comprehensiveAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 15000,
          languages: { typescript: 12000, javascript: 3000 }
        },
        testCoverage: {
          percentage: 55,
          uncoveredFiles: ['legacy1.ts', 'legacy2.ts']
        },
        dependencies: {
          outdated: [],
          security: [],
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 20,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coveragePercentage: 70,
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 70,
            total: 100,
            coveragePercentage: 70
          }
        } as EnhancedDocumentationAnalysis,
        performance: {
          bundleSize: 2560,
          slowTests: [],
          bottlenecks: []
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 62,
            uncoveredBranches: [
              { file: 'src/core.ts', line: 45, type: 'if', condition: 'validation check' },
              { file: 'src/utils.ts', line: 78, type: 'switch', condition: 'status handling' }
            ]
          },
          antiPatterns: [],
          untestedExports: [
            {
              name: 'coreFunction',
              file: 'src/api/core.ts',
              isPublic: true,
              type: 'function',
              line: 20
            },
            {
              name: 'utilityHelper',
              file: 'src/utils/helpers.ts',
              isPublic: true,
              type: 'function',
              line: 35
            }
          ]
        }
      };

      const candidates = analyzer.analyze(comprehensiveAnalysis);
      const debtAnalysis = analyzer.createTechnicalDebtAnalysis(comprehensiveAnalysis);

      // Acceptance Criterion 1: Processes untestedExports and branchCoverage from testAnalysis ✓
      expect(candidates).toBeDefined();
      expect(candidates.length).toBeGreaterThan(0);

      const testAnalysisCandidates = candidates.filter(c =>
        c.candidateId.includes('untested') || c.candidateId.includes('branch-coverage')
      );
      expect(testAnalysisCandidates.length).toBeGreaterThan(0);

      // Acceptance Criterion 2: Maps to 'testability' category with hotspots for untested files ✓
      const testabilityCategory = debtAnalysis.categories.find(c => c.category === 'testability');
      expect(testabilityCategory).toBeDefined();
      expect(testabilityCategory?.category).toBe('testability'); // Correct category name

      const testHotspots = debtAnalysis.hotspots.filter(h =>
        h.issues.some(issue => issue.includes('untested') || issue.includes('uncovered'))
      );
      expect(testHotspots.length).toBeGreaterThan(0);

      // Acceptance Criterion 3: Integrates testCoverage metric ✓
      expect(debtAnalysis.metrics).toBeDefined();
      expect(debtAnalysis.metrics?.testCoverage).toBe(62); // Should use testAnalysis branchCoverage
    });
  });
});