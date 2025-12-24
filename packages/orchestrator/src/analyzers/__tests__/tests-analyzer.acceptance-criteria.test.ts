/**
 * Acceptance Criteria Validation Tests for Enhanced TestsAnalyzer
 *
 * This test file specifically validates that the TestsAnalyzer meets the exact
 * acceptance criteria stated in the task:
 *
 * 1) Missing integration tests for critical paths
 * 2) Prioritizes based on path criticality (auth, payment, data)
 * 3) Includes remediation suggestions for integration test setup
 * 4) Unit tests pass
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TestsAnalyzer - Acceptance Criteria Validation', () => {
  let testsAnalyzer: TestsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    testsAnalyzer = new TestsAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { 'ts': 40, 'js': 10 } },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 5, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: {
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20, documentedEndpoints: 14, undocumentedItems: [],
            wellDocumentedExamples: [], commonIssues: []
          }
        }
      },
      performance: { slowTests: [], bottlenecks: [] },
      testCoverage: { percentage: 75, uncoveredFiles: [] },
      testAnalysis: {
        branchCoverage: { percentage: 80, uncoveredBranches: [] },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      }
    };
  });

  describe('AC1: Missing integration tests for critical paths', () => {
    it('should generate TaskCandidates for missing integration tests for critical paths', () => {
      // Setup critical paths that are missing integration tests
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Registration Flow',
          description: 'End-to-end user registration from signup to email verification',
          priority: 'critical',
          relatedFiles: ['src/auth/registration.service.ts', 'src/email/email.service.ts']
        },
        {
          criticalPath: 'Payment Processing Pipeline',
          description: 'Complete payment flow including validation and confirmation',
          priority: 'critical',
          relatedFiles: ['src/payment/stripe.service.ts']
        },
        {
          criticalPath: 'Data Export Workflow',
          description: 'User data export with format conversion',
          priority: 'high',
          relatedFiles: ['src/data/export.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate TaskCandidates for missing integration tests
      const integrationTestCandidates = candidates.filter(c =>
        c.candidateId.includes('integration-test') && !c.candidateId.includes('group')
      );

      expect(integrationTestCandidates).toHaveLength(3);

      // Verify TaskCandidate structure and content
      integrationTestCandidates.forEach(candidate => {
        expect(candidate.title).toContain('Add Integration Test:');
        expect(candidate.suggestedWorkflow).toBe('testing');
        expect(candidate.estimatedEffort).toBe('medium'); // Integration tests are typically medium effort
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.rationale).toContain('critical paths');
        expect(candidate.remediationSuggestions).toBeDefined();
        expect(candidate.remediationSuggestions.length).toBeGreaterThan(0);
      });

      // Verify specific critical paths are represented
      expect(integrationTestCandidates.some(c => c.title.includes('User Registration Flow'))).toBe(true);
      expect(integrationTestCandidates.some(c => c.title.includes('Payment Processing Pipeline'))).toBe(true);
      expect(integrationTestCandidates.some(c => c.title.includes('Data Export Workflow'))).toBe(true);
    });

    it('should handle scenarios with no missing integration tests', () => {
      // No missing integration tests
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const integrationTestCandidates = candidates.filter(c =>
        c.candidateId.includes('integration-test')
      );

      // Should not generate integration test TaskCandidates when none are missing
      expect(integrationTestCandidates).toHaveLength(0);
    });

    it('should identify various types of critical paths', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        { criticalPath: 'API Authentication', description: 'Auth flow', priority: 'critical' },
        { criticalPath: 'Database Migration', description: 'DB operations', priority: 'high' },
        { criticalPath: 'File Upload Processing', description: 'File handling', priority: 'medium' },
        { criticalPath: 'Email Notification System', description: 'Email delivery', priority: 'low' }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate candidates for all missing integration tests
      const allIntegrationCandidates = candidates.filter(c =>
        c.candidateId.includes('integration-test') || c.candidateId.includes('integration-tests-group')
      );

      expect(allIntegrationCandidates.length).toBeGreaterThan(0);

      // Critical and high should get individual tasks
      const individualTasks = candidates.filter(c =>
        c.candidateId.includes('integration-test') && !c.candidateId.includes('group')
      );
      expect(individualTasks).toHaveLength(2); // critical + high

      // Medium and low should be grouped
      const groupedTasks = candidates.filter(c =>
        c.candidateId.includes('integration-tests-group')
      );
      expect(groupedTasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AC2: Prioritizes based on path criticality (auth, payment, data)', () => {
    it('should prioritize authentication critical paths appropriately', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Authentication System',
          description: 'Login, logout, and session management',
          priority: 'critical'
        },
        {
          criticalPath: 'OAuth Integration Flow',
          description: 'Third-party authentication',
          priority: 'high'
        },
        {
          criticalPath: 'JWT Token Management',
          description: 'Token validation and refresh',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const authTasks = candidates.filter(c =>
        c.candidateId.includes('User-Authentication-System') ||
        c.candidateId.includes('OAuth-Integration-Flow') ||
        c.candidateId.includes('JWT-Token-Management')
      );

      expect(authTasks).toHaveLength(3);

      // Critical auth paths should be prioritized as urgent with high scores
      const criticalAuthTasks = authTasks.filter(t =>
        t.candidateId.includes('User-Authentication-System') ||
        t.candidateId.includes('JWT-Token-Management')
      );

      criticalAuthTasks.forEach(task => {
        expect(task.priority).toBe('urgent');
        expect(task.score).toBe(0.95); // High score for critical auth
      });

      // High priority auth should remain high
      const highAuthTask = authTasks.find(t => t.candidateId.includes('OAuth-Integration-Flow'));
      expect(highAuthTask?.priority).toBe('high');
      expect(highAuthTask?.score).toBe(0.8);
    });

    it('should prioritize payment critical paths appropriately', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Payment Processing Flow',
          description: 'Credit card payment handling',
          priority: 'critical'
        },
        {
          criticalPath: 'Subscription Billing Management',
          description: 'Recurring payment processing',
          priority: 'critical'
        },
        {
          criticalPath: 'Payment Refund System',
          description: 'Refund processing workflow',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const paymentTasks = candidates.filter(c =>
        c.candidateId.includes('Payment') ||
        c.candidateId.includes('Billing') ||
        c.candidateId.includes('Refund')
      );

      expect(paymentTasks).toHaveLength(3);

      // Critical payment paths should be urgent with high scores
      const criticalPaymentTasks = paymentTasks.filter(t =>
        t.candidateId.includes('Payment-Processing-Flow') ||
        t.candidateId.includes('Subscription-Billing-Management')
      );

      criticalPaymentTasks.forEach(task => {
        expect(task.priority).toBe('urgent');
        expect(task.score).toBe(0.95); // High score for critical payment
      });

      // High priority payment should remain high
      const highPaymentTask = paymentTasks.find(t => t.candidateId.includes('Payment-Refund-System'));
      expect(highPaymentTask?.priority).toBe('high');
      expect(highPaymentTask?.score).toBe(0.8);
    });

    it('should prioritize data processing critical paths appropriately', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Data Import Processing Pipeline',
          description: 'Large-scale data import validation',
          priority: 'critical'
        },
        {
          criticalPath: 'Data Transformation Engine',
          description: 'Complex data transformation operations',
          priority: 'high'
        },
        {
          criticalPath: 'Data Export System',
          description: 'Multi-format data export',
          priority: 'medium'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Critical data processing should be urgent
      const criticalDataTask = candidates.find(c =>
        c.candidateId.includes('Data-Import-Processing-Pipeline')
      );
      expect(criticalDataTask?.priority).toBe('urgent');
      expect(criticalDataTask?.score).toBe(0.95);

      // High data processing should remain high
      const highDataTask = candidates.find(c =>
        c.candidateId.includes('Data-Transformation-Engine')
      );
      expect(highDataTask?.priority).toBe('high');
      expect(highDataTask?.score).toBe(0.8);

      // Medium should be grouped
      const mediumGroupedTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-normal'
      );
      expect(mediumGroupedTask).toBeDefined();
    });

    it('should demonstrate clear prioritization ordering', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        { criticalPath: 'User Authentication', description: 'Auth', priority: 'critical' },
        { criticalPath: 'Payment Processing', description: 'Payment', priority: 'critical' },
        { criticalPath: 'Data Processing', description: 'Data', priority: 'critical' },
        { criticalPath: 'Email System', description: 'Email', priority: 'high' },
        { criticalPath: 'Logging System', description: 'Logging', priority: 'medium' }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = testsAnalyzer.prioritize(candidates);

      // Prioritized task should be one of the critical paths with highest score
      expect(prioritized).toBeDefined();
      expect(prioritized?.priority).toBe('urgent');
      expect(prioritized?.score).toBe(0.95);

      // Should be one of the critical auth/payment/data paths
      expect(
        prioritized?.candidateId.includes('Authentication') ||
        prioritized?.candidateId.includes('Payment') ||
        prioritized?.candidateId.includes('Data')
      ).toBe(true);
    });
  });

  describe('AC3: Includes remediation suggestions for integration test setup', () => {
    it('should provide comprehensive remediation suggestions for integration test setup', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Complete Integration Test Setup',
          description: 'Comprehensive integration testing',
          priority: 'critical',
          relatedFiles: ['src/auth/auth.service.ts', 'src/payment/payment.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const integrationTask = candidates.find(c =>
        c.candidateId.includes('Complete-Integration-Test-Setup')
      );

      expect(integrationTask).toBeDefined();

      const suggestions = integrationTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);

      // Should have test creation suggestion
      const testCreationSuggestion = suggestions.find(s =>
        s.type === 'testing' && s.description.includes('Create integration test')
      );
      expect(testCreationSuggestion).toBeDefined();
      expect(testCreationSuggestion?.expectedOutcome).toBeDefined();

      // Should have related files review suggestion
      const fileReviewSuggestion = suggestions.find(s =>
        s.type === 'manual_review' && s.description.includes('Review interaction')
      );
      expect(fileReviewSuggestion).toBeDefined();
      expect(fileReviewSuggestion?.description).toContain('auth.service.ts');
      expect(fileReviewSuggestion?.description).toContain('payment.service.ts');

      // Should have infrastructure setup suggestion
      const infrastructureSuggestion = suggestions.find(s =>
        s.description.includes('Configure integration test infrastructure')
      );
      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('database seeding');
    });

    it('should provide authentication-specific setup suggestions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Authentication Integration Testing',
          description: 'Auth flow testing',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const authTask = candidates.find(c =>
        c.candidateId.includes('Authentication-Integration-Testing')
      );

      const suggestions = authTask?.remediationSuggestions || [];

      // Should have auth-specific setup
      const authSetupSuggestion = suggestions.find(s =>
        s.description.includes('Set up authentication test environment')
      );
      expect(authSetupSuggestion).toBeDefined();
      expect(authSetupSuggestion?.command).toContain('JWT_SECRET');

      // Should have security review
      const securitySuggestion = suggestions.find(s =>
        s.description.includes('Review security boundaries')
      );
      expect(securitySuggestion).toBeDefined();
      expect(securitySuggestion?.warning).toContain('Security-critical');
    });

    it('should provide payment-specific setup suggestions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Payment Integration Testing',
          description: 'Payment flow testing',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const paymentTask = candidates.find(c =>
        c.candidateId.includes('Payment-Integration-Testing')
      );

      const suggestions = paymentTask?.remediationSuggestions || [];

      // Should have payment-specific setup
      const paymentSetupSuggestion = suggestions.find(s =>
        s.description.includes('Set up payment test environment')
      );
      expect(paymentSetupSuggestion).toBeDefined();
      expect(paymentSetupSuggestion?.command).toContain('STRIPE_TEST_SECRET_KEY');

      // Should have financial risk warning
      const riskSuggestion = suggestions.find(s =>
        s.warning && s.warning.includes('financial losses')
      );
      expect(riskSuggestion).toBeDefined();
    });

    it('should provide data-specific setup suggestions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Data Integration Testing',
          description: 'Data processing testing',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const dataTask = candidates.find(c =>
        c.candidateId.includes('Data-Integration-Testing')
      );

      const suggestions = dataTask?.remediationSuggestions || [];

      // Should have data-specific setup
      const dataSetupSuggestion = suggestions.find(s =>
        s.description.includes('Set up test data fixtures')
      );
      expect(dataSetupSuggestion).toBeDefined();
      expect(dataSetupSuggestion?.command).toContain('transformation pipelines');
    });

    it('should provide infrastructure setup instructions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Infrastructure Integration Testing',
          description: 'System infrastructure testing',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const infraTask = candidates.find(c =>
        c.candidateId.includes('Infrastructure-Integration-Testing')
      );

      const suggestions = infraTask?.remediationSuggestions || [];

      // Should have infrastructure setup
      const infrastructureSuggestion = suggestions.find(s =>
        s.command && s.command.includes('Integration Test Infrastructure')
      );
      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('docker-compose');
      expect(infrastructureSuggestion?.command).toContain('test:db:setup');
    });
  });

  describe('AC4: Unit tests pass (implicit requirement)', () => {
    it('should have basic functionality working (analyzer type)', () => {
      expect(testsAnalyzer.type).toBe('tests');
    });

    it('should analyze project successfully without throwing errors', () => {
      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should prioritize candidates without throwing errors', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Test Priority',
          description: 'Test prioritization',
          priority: 'high'
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        const prioritized = testsAnalyzer.prioritize(candidates);
        expect(prioritized).toBeDefined();
      }).not.toThrow();
    });

    it('should handle edge cases gracefully', () => {
      // Test with undefined/null values
      const malformedAnalysis = {
        ...baseProjectAnalysis,
        testAnalysis: {
          ...baseProjectAnalysis.testAnalysis,
          missingIntegrationTests: undefined as any
        }
      };

      expect(() => {
        const candidates = testsAnalyzer.analyze(malformedAnalysis);
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Complete Acceptance Criteria Integration Test', () => {
    it('should satisfy all acceptance criteria in a comprehensive scenario', () => {
      // Setup a comprehensive scenario with auth, payment, and data critical paths
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Authentication and Authorization',
          description: 'Complete auth flow with role-based access control',
          priority: 'critical',
          relatedFiles: ['src/auth/auth.service.ts', 'src/auth/rbac.service.ts']
        },
        {
          criticalPath: 'Payment Processing and Billing',
          description: 'End-to-end payment with subscription management',
          priority: 'critical',
          relatedFiles: ['src/payment/stripe.service.ts', 'src/billing/subscription.service.ts']
        },
        {
          criticalPath: 'Data Import and Transformation',
          description: 'Large-scale data processing pipeline',
          priority: 'critical',
          relatedFiles: ['src/data/import.service.ts', 'src/data/transform.service.ts']
        },
        {
          criticalPath: 'API Rate Limiting',
          description: 'API throttling and rate limiting',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // AC1: Should generate TaskCandidates for missing integration tests
      const integrationCandidates = candidates.filter(c =>
        c.candidateId.includes('integration-test')
      );
      expect(integrationCandidates.length).toBeGreaterThan(0);

      // AC2: Should prioritize based on criticality (auth, payment, data)
      const criticalTasks = integrationCandidates.filter(t => t.priority === 'urgent');
      expect(criticalTasks).toHaveLength(3); // All critical paths should be urgent

      const authTask = criticalTasks.find(t => t.candidateId.includes('Authentication'));
      const paymentTask = criticalTasks.find(t => t.candidateId.includes('Payment'));
      const dataTask = criticalTasks.find(t => t.candidateId.includes('Data'));

      expect(authTask).toBeDefined();
      expect(paymentTask).toBeDefined();
      expect(dataTask).toBeDefined();

      // All critical tasks should have maximum score
      [authTask, paymentTask, dataTask].forEach(task => {
        expect(task?.score).toBe(0.95);
      });

      // High priority should remain high
      const highTask = integrationCandidates.find(t => t.candidateId.includes('API-Rate-Limiting'));
      expect(highTask?.priority).toBe('high');
      expect(highTask?.score).toBe(0.8);

      // AC3: Should include remediation suggestions for integration test setup
      [authTask, paymentTask, dataTask, highTask].forEach(task => {
        if (task) {
          expect(task.remediationSuggestions.length).toBeGreaterThan(0);

          // Each should have test creation suggestion
          const testSuggestion = task.remediationSuggestions.find(s =>
            s.type === 'testing'
          );
          expect(testSuggestion).toBeDefined();

          // Each should have infrastructure setup
          const setupSuggestion = task.remediationSuggestions.find(s =>
            s.description.includes('infrastructure') ||
            s.description.includes('environment') ||
            s.description.includes('Set up')
          );
          expect(setupSuggestion).toBeDefined();
        }
      });

      // Verify auth-specific suggestions
      const authSuggestions = authTask?.remediationSuggestions || [];
      expect(authSuggestions.some(s => s.command?.includes('JWT_SECRET'))).toBe(true);

      // Verify payment-specific suggestions
      const paymentSuggestions = paymentTask?.remediationSuggestions || [];
      expect(paymentSuggestions.some(s => s.command?.includes('STRIPE_TEST_SECRET_KEY'))).toBe(true);

      // Verify data-specific suggestions
      const dataSuggestions = dataTask?.remediationSuggestions || [];
      expect(dataSuggestions.some(s => s.command?.includes('transformation pipelines'))).toBe(true);

      // AC4: Unit tests pass (verified by this test running successfully)
      expect(true).toBe(true);
    });
  });
});