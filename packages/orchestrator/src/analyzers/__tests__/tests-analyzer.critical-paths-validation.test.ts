/**
 * Critical Paths Validation Tests for TestsAnalyzer
 *
 * Comprehensive validation tests ensuring the enhanced TestsAnalyzer correctly:
 * 1) Generates TaskCandidates for missing integration tests
 * 2) Prioritizes based on path criticality (auth, payment, data)
 * 3) Includes proper remediation suggestions for integration test setup
 * 4) Handles edge cases and error conditions gracefully
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';
import type { TaskCandidate } from '../index';

describe('TestsAnalyzer - Critical Paths Validation', () => {
  let testsAnalyzer: TestsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    testsAnalyzer = new TestsAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { 'ts': 40, 'js': 10 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 14,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      },
      testCoverage: {
        percentage: 75,
        uncoveredFiles: []
      },
      testAnalysis: {
        branchCoverage: {
          percentage: 80,
          uncoveredBranches: []
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      }
    };
  });

  describe('TaskCandidate Generation Validation', () => {
    it('should generate TaskCandidates for all missing integration tests', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Authentication Flow',
          description: 'User login and session management',
          priority: 'critical',
          relatedFiles: ['src/auth/auth.service.ts']
        },
        {
          criticalPath: 'Payment Processing',
          description: 'Payment gateway integration',
          priority: 'high',
          relatedFiles: ['src/payment/payment.service.ts']
        },
        {
          criticalPath: 'Data Export',
          description: 'User data export functionality',
          priority: 'medium'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate individual TaskCandidates for critical and high priority
      const integrationTasks = candidates.filter(c =>
        c.candidateId.includes('integration-test') && !c.candidateId.includes('group')
      );
      expect(integrationTasks).toHaveLength(2); // critical and high get individual tasks

      // Should generate grouped TaskCandidate for medium priority
      const groupedTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-normal'
      );
      expect(groupedTask).toBeDefined();

      // All TaskCandidates should have proper structure
      const allIntegrationCandidates = [...integrationTasks, groupedTask].filter(Boolean);
      allIntegrationCandidates.forEach(candidate => {
        expect(candidate.title).toBeDefined();
        expect(candidate.description).toBeDefined();
        expect(candidate.priority).toBeDefined();
        expect(candidate.estimatedEffort).toBeDefined();
        expect(candidate.suggestedWorkflow).toBe('testing');
        expect(candidate.rationale).toBeDefined();
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(Array.isArray(candidate.remediationSuggestions)).toBe(true);
      });
    });

    it('should generate no TaskCandidates when no integration tests are missing', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const integrationTasks = candidates.filter(c =>
        c.candidateId.includes('integration-test')
      );
      expect(integrationTasks).toHaveLength(0);
    });

    it('should handle undefined missingIntegrationTests gracefully', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = undefined as any;

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Path Criticality Prioritization Validation', () => {
    describe('Authentication Paths', () => {
      it('should prioritize authentication paths as urgent when priority is critical', () => {
        baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
          {
            criticalPath: 'User Authentication System',
            description: 'Core authentication workflow',
            priority: 'critical'
          },
          {
            criticalPath: 'JWT Token Management',
            description: 'Token lifecycle management',
            priority: 'critical'
          },
          {
            criticalPath: 'OAuth Integration Flow',
            description: 'Third-party authentication',
            priority: 'high'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const authTasks = candidates.filter(c =>
          c.candidateId.includes('integration-test') &&
          (c.candidateId.includes('Authentication') ||
           c.candidateId.includes('JWT') ||
           c.candidateId.includes('OAuth'))
        );

        expect(authTasks).toHaveLength(3);

        const criticalAuthTasks = authTasks.filter(t => t.priority === 'urgent');
        const highAuthTasks = authTasks.filter(t => t.priority === 'high');

        expect(criticalAuthTasks).toHaveLength(2); // critical priority → urgent
        expect(highAuthTasks).toHaveLength(1); // high priority → high

        // All auth tasks should have high scores
        authTasks.forEach(task => {
          expect(task.score).toBeGreaterThanOrEqual(0.8);
        });
      });

      it('should provide authentication-specific remediation for auth paths', () => {
        baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
          {
            criticalPath: 'Multi-Factor Authentication',
            description: 'MFA verification process',
            priority: 'critical'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        const mfaTask = candidates.find(c => c.candidateId.includes('Multi-Factor-Authentication'));

        expect(mfaTask).toBeDefined();

        const suggestions = mfaTask?.remediationSuggestions || [];

        // Should have authentication-specific suggestions
        const authSetupSuggestion = suggestions.find(s =>
          s.description.includes('Set up authentication test environment')
        );
        expect(authSetupSuggestion).toBeDefined();

        const securityReviewSuggestion = suggestions.find(s =>
          s.description.includes('Review security boundaries')
        );
        expect(securityReviewSuggestion).toBeDefined();
        expect(securityReviewSuggestion?.warning).toContain('Security-critical');
      });
    });

    describe('Payment Paths', () => {
      it('should prioritize payment paths as urgent with appropriate scoring', () => {
        baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
          {
            criticalPath: 'Credit Card Payment Processing',
            description: 'Stripe integration for payments',
            priority: 'critical'
          },
          {
            criticalPath: 'Subscription Billing Management',
            description: 'Recurring payment handling',
            priority: 'critical'
          },
          {
            criticalPath: 'Payment Refund Processing',
            description: 'Refund workflow',
            priority: 'high'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const paymentTasks = candidates.filter(c =>
          c.candidateId.includes('integration-test') &&
          (c.candidateId.includes('Payment') ||
           c.candidateId.includes('Billing') ||
           c.candidateId.includes('Refund'))
        );

        expect(paymentTasks).toHaveLength(3);

        const criticalPaymentTasks = paymentTasks.filter(t => t.priority === 'urgent');
        expect(criticalPaymentTasks).toHaveLength(2);

        // Payment tasks should have high scores due to financial risk
        paymentTasks.forEach(task => {
          expect(task.score).toBeGreaterThanOrEqual(0.8);
        });
      });

      it('should provide payment-specific remediation with financial warnings', () => {
        baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
          {
            criticalPath: 'Financial Transaction Validation',
            description: 'Money transfer security checks',
            priority: 'critical'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        const finTask = candidates.find(c => c.candidateId.includes('Financial-Transaction-Validation'));

        const suggestions = finTask?.remediationSuggestions || [];

        // Should have payment-specific setup
        const paymentSetupSuggestion = suggestions.find(s =>
          s.description.includes('Set up payment test environment')
        );
        expect(paymentSetupSuggestion).toBeDefined();

        // Should have financial risk warnings
        const riskWarningSuggestion = suggestions.find(s =>
          s.warning && s.warning.includes('financial losses')
        );
        expect(riskWarningSuggestion).toBeDefined();
        expect(riskWarningSuggestion?.priority).toBe('critical');
      });
    });

    describe('Data Processing Paths', () => {
      it('should properly prioritize data processing paths', () => {
        baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
          {
            criticalPath: 'Critical Data Pipeline Processing',
            description: 'Mission-critical data transformation',
            priority: 'critical'
          },
          {
            criticalPath: 'Data Import Validation System',
            description: 'Data quality validation',
            priority: 'high'
          },
          {
            criticalPath: 'Report Generation Engine',
            description: 'Automated report creation',
            priority: 'medium'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

        const dataTasks = candidates.filter(c =>
          c.candidateId.includes('integration-test') &&
          c.description.toLowerCase().includes('data')
        );

        expect(dataTasks.length).toBeGreaterThan(0);

        // Critical data processing should be urgent
        const criticalDataTask = candidates.find(c =>
          c.candidateId.includes('Critical-Data-Pipeline-Processing')
        );
        expect(criticalDataTask?.priority).toBe('urgent');
        expect(criticalDataTask?.score).toBe(0.95);

        // High priority should remain high
        const highDataTask = candidates.find(c =>
          c.candidateId.includes('Data-Import-Validation-System')
        );
        expect(highDataTask?.priority).toBe('high');
      });

      it('should provide data-specific remediation suggestions', () => {
        baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
          {
            criticalPath: 'ETL Pipeline Integration',
            description: 'Extract, Transform, Load operations',
            priority: 'critical'
          }
        ];

        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        const etlTask = candidates.find(c => c.candidateId.includes('ETL-Pipeline-Integration'));

        const suggestions = etlTask?.remediationSuggestions || [];

        // Should have data-specific setup
        const dataSetupSuggestion = suggestions.find(s =>
          s.description.includes('Set up test data fixtures')
        );
        expect(dataSetupSuggestion).toBeDefined();
        expect(dataSetupSuggestion?.command).toContain('transformation pipelines');
      });
    });
  });

  describe('Remediation Suggestions Validation', () => {
    it('should include comprehensive remediation suggestions for each task type', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Comprehensive System Integration',
          description: 'Multi-component integration test',
          priority: 'critical',
          relatedFiles: [
            'src/auth/auth.service.ts',
            'src/payment/payment.service.ts',
            'src/data/data.service.ts'
          ]
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const systemTask = candidates.find(c => c.candidateId.includes('Comprehensive-System-Integration'));

      expect(systemTask).toBeDefined();

      const suggestions = systemTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have test creation suggestion
      const testCreationSuggestion = suggestions.find(s =>
        s.type === 'testing' && s.priority === 'urgent'
      );
      expect(testCreationSuggestion).toBeDefined();
      expect(testCreationSuggestion?.description).toContain('Create integration test');

      // Should have related files review
      const fileReviewSuggestion = suggestions.find(s =>
        s.type === 'manual_review' && s.description.includes('Review interaction')
      );
      expect(fileReviewSuggestion).toBeDefined();
      expect(fileReviewSuggestion?.description).toContain('auth.service.ts');
      expect(fileReviewSuggestion?.description).toContain('payment.service.ts');
      expect(fileReviewSuggestion?.description).toContain('data.service.ts');

      // Should have infrastructure setup
      const infrastructureSuggestion = suggestions.find(s =>
        s.description.includes('Configure integration test infrastructure')
      );
      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('database seeding');
      expect(infrastructureSuggestion?.command).toContain('cleanup procedures');
    });

    it('should provide appropriate infrastructure setup for complex scenarios', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Microservices Communication Testing',
          description: 'Inter-service communication validation',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const microTask = candidates.find(c => c.candidateId.includes('Microservices-Communication-Testing'));

      const suggestions = microTask?.remediationSuggestions || [];
      const infrastructureSuggestion = suggestions.find(s =>
        s.command && s.command.includes('Integration Test Infrastructure')
      );

      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('docker-compose.test.yml');
      expect(infrastructureSuggestion?.command).toContain('test:db:setup');
      expect(infrastructureSuggestion?.command).toContain('test:db:teardown');
    });
  });

  describe('Grouping Logic Validation', () => {
    it('should properly group medium and low priority integration tests', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Medium Priority Test 1',
          description: 'Test 1',
          priority: 'medium'
        },
        {
          criticalPath: 'Medium Priority Test 2',
          description: 'Test 2',
          priority: 'medium'
        },
        {
          criticalPath: 'Low Priority Test 1',
          description: 'Test 3',
          priority: 'low'
        },
        {
          criticalPath: 'Low Priority Test 2',
          description: 'Test 4',
          priority: 'low'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const mediumGroupedTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-normal'
      );
      expect(mediumGroupedTask).toBeDefined();
      expect(mediumGroupedTask?.title).toBe('Add 2 Integration Tests');
      expect(mediumGroupedTask?.priority).toBe('normal');

      const lowGroupedTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-low'
      );
      expect(lowGroupedTask).toBeDefined();
      expect(lowGroupedTask?.title).toBe('Add 2 Integration Tests');
      expect(lowGroupedTask?.priority).toBe('low');
    });

    it('should handle high priority test grouping when there are many', () => {
      const manyHighTests = Array.from({ length: 5 }, (_, i) => ({
        criticalPath: `High Priority Integration ${i + 1}`,
        description: `Integration test ${i + 1}`,
        priority: 'high' as const
      }));

      baseProjectAnalysis.testAnalysis.missingIntegrationTests = manyHighTests;

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should group high priority tests since there are more than 2
      const groupedHighTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-high'
      );
      expect(groupedHighTask).toBeDefined();
      expect(groupedHighTask?.title).toBe('Add 5 Integration Tests');
      expect(groupedHighTask?.priority).toBe('high');
      expect(groupedHighTask?.estimatedEffort).toBe('high'); // > 5 tests
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed priority values gracefully', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Test with Invalid Priority',
          description: 'Test description',
          priority: 'invalid-priority' as any
        },
        {
          criticalPath: 'Test with Null Priority',
          description: 'Test description',
          priority: null as any
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle missing required fields gracefully', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: '',
          description: '',
          priority: 'critical'
        } as any,
        {
          criticalPath: 'Valid Test',
          // missing description
          priority: 'high'
        } as any
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle very large numbers of integration tests efficiently', () => {
      const manyTests = Array.from({ length: 100 }, (_, i) => ({
        criticalPath: `Test ${i + 1}`,
        description: `Integration test ${i + 1}`,
        priority: i < 10 ? 'critical' : i < 30 ? 'high' : i < 60 ? 'medium' : 'low'
      } as any));

      baseProjectAnalysis.testAnalysis.missingIntegrationTests = manyTests;

      const startTime = Date.now();
      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should generate reasonable number of candidates (individual + grouped)
      const integrationCandidates = candidates.filter(c => c.candidateId.includes('integration'));
      expect(integrationCandidates.length).toBeGreaterThan(0);
      expect(integrationCandidates.length).toBeLessThan(50); // Should group appropriately
    });

    it('should handle special characters in critical path names safely', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Test/With\\Special*Characters?<>:|"',
          description: 'Test with special characters',
          priority: 'high'
        },
        {
          criticalPath: 'Test with émojis 🚀 and ůnïcødé',
          description: 'Unicode test',
          priority: 'medium'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const integrationCandidates = candidates.filter(c => c.candidateId.includes('integration'));
      expect(integrationCandidates.length).toBeGreaterThan(0);

      // Candidate IDs should be safe for file names
      integrationCandidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^[a-zA-Z0-9-_]+$/);
        expect(candidate.candidateId).not.toContain('/');
        expect(candidate.candidateId).not.toContain('\\');
        expect(candidate.candidateId).not.toContain('*');
      });
    });
  });

  describe('Integration Test Task Quality Validation', () => {
    it('should ensure all integration test tasks have complete metadata', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Complete Metadata Test',
          description: 'Test for complete task metadata',
          priority: 'critical',
          relatedFiles: ['src/test/test.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const integrationTasks = candidates.filter(c => c.candidateId.includes('integration'));

      expect(integrationTasks.length).toBeGreaterThan(0);

      integrationTasks.forEach(task => {
        // Required fields
        expect(task.candidateId).toBeTruthy();
        expect(task.title).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(task.priority).toBeTruthy();
        expect(task.estimatedEffort).toBeTruthy();
        expect(task.suggestedWorkflow).toBe('testing');
        expect(task.rationale).toBeTruthy();

        // Score should be valid
        expect(typeof task.score).toBe('number');
        expect(task.score).toBeGreaterThan(0);
        expect(task.score).toBeLessThanOrEqual(1);

        // Remediation suggestions should be comprehensive
        expect(Array.isArray(task.remediationSuggestions)).toBe(true);
        expect(task.remediationSuggestions.length).toBeGreaterThan(0);

        task.remediationSuggestions.forEach(suggestion => {
          expect(suggestion.type).toBeTruthy();
          expect(suggestion.description).toBeTruthy();
          expect(suggestion.priority).toBeTruthy();
          expect(suggestion.expectedOutcome).toBeTruthy();
        });
      });
    });

    it('should ensure effort estimation aligns with task complexity', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Simple API Test',
          description: 'Basic endpoint testing',
          priority: 'high'
        },
        {
          criticalPath: 'Complex Multi-Service Integration',
          description: 'Full system integration across multiple microservices with data flow validation',
          priority: 'critical',
          relatedFiles: [
            'src/service1/api.ts',
            'src/service2/handler.ts',
            'src/service3/processor.ts',
            'src/database/migration.ts',
            'src/auth/middleware.ts'
          ]
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const simpleTask = candidates.find(c => c.candidateId.includes('Simple-API-Test'));
      const complexTask = candidates.find(c => c.candidateId.includes('Complex-Multi-Service-Integration'));

      expect(simpleTask).toBeDefined();
      expect(complexTask).toBeDefined();

      // Simple task should have medium effort
      expect(simpleTask?.estimatedEffort).toBe('medium');

      // Complex task should have medium effort (default for integration tests)
      expect(complexTask?.estimatedEffort).toBe('medium');
    });
  });
});