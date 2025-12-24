/**
 * Integration Tests for TestsAnalyzer - Critical Path Testing
 *
 * Tests for the enhanced TestsAnalyzer functionality specifically focusing on:
 * 1) Missing integration tests for critical paths
 * 2) Prioritization based on path criticality (auth, payment, data)
 * 3) Remediation suggestions for integration test setup
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TestsAnalyzer - Integration Tests for Critical Paths', () => {
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

  describe('Critical Authentication Paths', () => {
    it('should prioritize authentication critical paths as urgent', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Authentication Flow',
          description: 'End-to-end authentication from login to token validation',
          priority: 'critical',
          relatedFiles: ['src/auth/auth.service.ts', 'src/auth/jwt.service.ts', 'src/middleware/auth.middleware.ts']
        },
        {
          criticalPath: 'Token Refresh Mechanism',
          description: 'JWT token refresh and validation flow',
          priority: 'critical',
          relatedFiles: ['src/auth/token.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const authTasks = candidates.filter(c =>
        c.candidateId.includes('integration-test') &&
        (c.candidateId.includes('User-Authentication-Flow') || c.candidateId.includes('Token-Refresh-Mechanism'))
      );

      expect(authTasks).toHaveLength(2);
      authTasks.forEach(task => {
        expect(task.priority).toBe('urgent');
        expect(task.score).toBe(0.95);
        expect(task.suggestedWorkflow).toBe('testing');
      });

      // Check for specific authentication remediation suggestions
      const authTask = authTasks.find(t => t.candidateId.includes('User-Authentication-Flow'));
      const suggestions = authTask?.remediationSuggestions || [];

      const authSetupSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Set up authentication test environment')
      );
      expect(authSetupSuggestion).toBeDefined();
      expect(authSetupSuggestion?.command).toContain('JWT_SECRET');
      expect(authSetupSuggestion?.command).toContain('generateTestToken');
    });

    it('should detect various authentication-related critical paths', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Login with OAuth Integration',
          description: 'OAuth flow integration test',
          priority: 'critical'
        },
        {
          criticalPath: 'Multi-factor Authentication Flow',
          description: 'MFA verification process',
          priority: 'high'
        },
        {
          criticalPath: 'Password Reset Token Validation',
          description: 'Password reset flow validation',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const authCandidates = candidates.filter(c =>
        c.description.toLowerCase().includes('oauth') ||
        c.description.toLowerCase().includes('multi-factor') ||
        c.description.toLowerCase().includes('password reset')
      );

      expect(authCandidates.length).toBeGreaterThan(0);

      // OAuth should be urgent as it's critical
      const oauthTask = authCandidates.find(c => c.description.includes('OAuth'));
      expect(oauthTask?.priority).toBe('urgent');
    });
  });

  describe('Critical Payment Paths', () => {
    it('should prioritize payment critical paths as urgent with comprehensive remediation', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Payment Processing Pipeline',
          description: 'End-to-end payment flow from initiation to confirmation',
          priority: 'critical',
          relatedFiles: ['src/payment/stripe.service.ts', 'src/payment/webhook.handler.ts']
        },
        {
          criticalPath: 'Subscription Billing Integration',
          description: 'Recurring billing and subscription management',
          priority: 'critical',
          relatedFiles: ['src/billing/subscription.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const paymentTasks = candidates.filter(c =>
        c.candidateId.includes('integration-test') &&
        (c.candidateId.includes('Payment-Processing-Pipeline') || c.candidateId.includes('Subscription-Billing-Integration'))
      );

      expect(paymentTasks).toHaveLength(2);
      paymentTasks.forEach(task => {
        expect(task.priority).toBe('urgent');
        expect(task.score).toBe(0.95);
      });

      // Check for payment-specific remediation suggestions
      const paymentTask = paymentTasks.find(t => t.candidateId.includes('Payment-Processing-Pipeline'));
      const suggestions = paymentTask?.remediationSuggestions || [];

      const paymentSetupSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Set up payment test environment')
      );
      expect(paymentSetupSuggestion).toBeDefined();
      expect(paymentSetupSuggestion?.command).toContain('STRIPE_TEST_SECRET_KEY');
      expect(paymentSetupSuggestion?.command).toContain('TEST_CARDS');

      const webhookSuggestion = suggestions.find(s =>
        s.description.includes('webhooks')
      );
      expect(webhookSuggestion).toBeDefined();
    });

    it('should include payment-specific security warnings in remediation', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Credit Card Processing Security',
          description: 'PCI-compliant payment processing validation',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const paymentTask = candidates.find(c => c.description.includes('PCI-compliant'));
      expect(paymentTask).toBeDefined();

      const suggestions = paymentTask?.remediationSuggestions || [];
      const securityWarning = suggestions.find(s =>
        s.warning && s.warning.includes('financial losses')
      );
      expect(securityWarning).toBeDefined();
      expect(securityWarning?.priority).toBe('critical');
    });
  });

  describe('Critical Data Processing Paths', () => {
    it('should prioritize data processing critical paths with appropriate effort estimation', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Data Import Processing Pipeline',
          description: 'Large-scale data import with validation and transformation',
          priority: 'critical',
          relatedFiles: ['src/data/import.service.ts', 'src/data/validation.service.ts']
        },
        {
          criticalPath: 'Real-time Data Synchronization',
          description: 'Data sync between multiple systems',
          priority: 'high',
          relatedFiles: ['src/sync/data-sync.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const dataTask = candidates.find(c =>
        c.candidateId.includes('Data-Import-Processing-Pipeline')
      );
      expect(dataTask).toBeDefined();
      expect(dataTask?.priority).toBe('urgent');
      expect(dataTask?.estimatedEffort).toBe('medium');

      // Check for data-specific remediation suggestions
      const suggestions = dataTask?.remediationSuggestions || [];

      const dataSetupSuggestion = suggestions.find(s =>
        s.type === 'testing' &&
        s.description.includes('Set up test data fixtures')
      );
      expect(dataSetupSuggestion).toBeDefined();
      expect(dataSetupSuggestion?.command).toContain('transformation pipelines');
    });

    it('should provide comprehensive data testing infrastructure setup', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'ETL Pipeline Validation',
          description: 'Extract, Transform, Load pipeline testing',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const etlTask = candidates.find(c => c.description.includes('Extract, Transform, Load'));
      expect(etlTask).toBeDefined();

      const suggestions = etlTask?.remediationSuggestions || [];
      const infrastructureSuggestion = suggestions.find(s =>
        s.description.includes('Configure integration test infrastructure')
      );
      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('database seeding');
    });
  });

  describe('Critical Path Prioritization Logic', () => {
    it('should correctly prioritize mixed critical paths by type and urgency', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Login Authentication',
          description: 'Core authentication flow',
          priority: 'critical'
        },
        {
          criticalPath: 'Payment Transaction Validation',
          description: 'Financial transaction security',
          priority: 'critical'
        },
        {
          criticalPath: 'Data Export Functionality',
          description: 'User data export feature',
          priority: 'high'
        },
        {
          criticalPath: 'Email Notification System',
          description: 'System notification delivery',
          priority: 'medium'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Critical paths should get individual urgent tasks
      const criticalTasks = candidates.filter(c =>
        c.priority === 'urgent' && c.candidateId.includes('integration-test')
      );
      expect(criticalTasks).toHaveLength(2);

      // High priority paths should get individual high tasks
      const highTasks = candidates.filter(c =>
        c.priority === 'high' && c.candidateId.includes('integration-test')
      );
      expect(highTasks).toHaveLength(1);

      // Medium priority should be grouped
      const mediumGroupedTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-normal'
      );
      expect(mediumGroupedTask).toBeDefined();
    });

    it('should handle large numbers of integration tests with appropriate grouping', () => {
      // Create many integration tests of different priorities
      const manyHighPriorityTests = Array.from({ length: 6 }, (_, i) => ({
        criticalPath: `High Priority Path ${i + 1}`,
        description: `Description for path ${i + 1}`,
        priority: 'high' as const
      }));

      baseProjectAnalysis.testAnalysis.missingIntegrationTests = manyHighPriorityTests;

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Should group high priority tests since there are more than 2
      const groupedTask = candidates.find(c =>
        c.candidateId === 'tests-integration-tests-group-high'
      );
      expect(groupedTask).toBeDefined();
      expect(groupedTask?.title).toBe('Add 6 Integration Tests');
      expect(groupedTask?.priority).toBe('high');
      expect(groupedTask?.estimatedEffort).toBe('high'); // > 5 tests
    });
  });

  describe('Remediation Suggestion Completeness', () => {
    it('should provide specific setup instructions for each critical path type', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Authentication Security Validation',
          description: 'Security-focused auth testing',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const authTask = candidates.find(c => c.candidateId.includes('Authentication-Security-Validation'));

      const suggestions = authTask?.remediationSuggestions || [];

      // Should have test creation suggestion
      const testCreationSuggestion = suggestions.find(s =>
        s.type === 'testing' && s.priority === 'urgent'
      );
      expect(testCreationSuggestion).toBeDefined();
      expect(testCreationSuggestion?.command).toContain('Authentication Integration');

      // Should have setup suggestions
      const setupSuggestion = suggestions.find(s =>
        s.description.includes('Set up authentication test environment')
      );
      expect(setupSuggestion).toBeDefined();

      // Should have security review suggestion
      const securitySuggestion = suggestions.find(s =>
        s.description.includes('Review security boundaries')
      );
      expect(securitySuggestion).toBeDefined();
      expect(securitySuggestion?.warning).toContain('Security-critical');
    });

    it('should include infrastructure setup for complex integration scenarios', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Multi-Service Data Flow',
          description: 'Cross-service data integration',
          priority: 'critical',
          relatedFiles: [
            'src/services/service-a.ts',
            'src/services/service-b.ts',
            'src/services/service-c.ts'
          ]
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const multiServiceTask = candidates.find(c => c.candidateId.includes('Multi-Service-Data-Flow'));

      const suggestions = multiServiceTask?.remediationSuggestions || [];

      // Should have related files review
      const fileReviewSuggestion = suggestions.find(s =>
        s.description.includes('service-a.ts, service-b.ts, service-c.ts')
      );
      expect(fileReviewSuggestion).toBeDefined();

      // Should have infrastructure setup
      const infrastructureSuggestion = suggestions.find(s =>
        s.description.includes('Configure integration test infrastructure')
      );
      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('database seeding');
      expect(infrastructureSuggestion?.command).toContain('cleanup procedures');
    });
  });

  describe('Template Generation for Critical Paths', () => {
    it('should generate appropriate templates based on critical path type detection', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'User Login with JWT Token',
          description: 'JWT-based authentication flow',
          priority: 'critical'
        },
        {
          criticalPath: 'Stripe Payment Processing',
          description: 'Credit card payment via Stripe',
          priority: 'critical'
        },
        {
          criticalPath: 'Database Transaction Processing',
          description: 'Complex database operations',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      // Auth template should include JWT setup
      const authTask = candidates.find(c => c.candidateId.includes('User-Login-with-JWT-Token'));
      const authSuggestions = authTask?.remediationSuggestions || [];
      const authTemplate = authSuggestions.find(s => s.command?.includes('JWT'));
      expect(authTemplate).toBeDefined();
      expect(authTemplate?.command).toContain('Authentication Integration');
      expect(authTemplate?.command).toContain('supertest');

      // Payment template should include Stripe setup
      const paymentTask = candidates.find(c => c.candidateId.includes('Stripe-Payment-Processing'));
      const paymentSuggestions = paymentTask?.remediationSuggestions || [];
      const paymentTemplate = paymentSuggestions.find(s => s.command?.includes('Stripe'));
      expect(paymentTemplate).toBeDefined();
      expect(paymentTemplate?.command).toContain('Payment Integration');
      expect(paymentTemplate?.command).toContain('4242424242424242'); // Test card

      // Database template should include transaction handling
      const dbTask = candidates.find(c => c.candidateId.includes('Database-Transaction-Processing'));
      const dbSuggestions = dbTask?.remediationSuggestions || [];
      const dbTemplate = dbSuggestions.find(s => s.command?.includes('Database Integration'));
      expect(dbTemplate).toBeDefined();
      expect(dbTemplate?.command).toContain('transaction');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing integration test priority gracefully', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Unknown Priority Test',
          description: 'Test with missing priority field',
          priority: undefined as any
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });

    it('should handle integration tests with no related files', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Standalone Integration Test',
          description: 'Test without related files',
          priority: 'high'
          // relatedFiles intentionally omitted
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);

      const standaloneTask = candidates.find(c => c.candidateId.includes('Standalone-Integration-Test'));
      expect(standaloneTask).toBeDefined();

      // Should still have remediation suggestions even without related files
      const suggestions = standaloneTask?.remediationSuggestions || [];
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle malformed critical path names', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: '', // Empty name
          description: 'Test with empty critical path',
          priority: 'medium'
        },
        {
          criticalPath: '!!!@#$%^&*()!!!', // Special characters
          description: 'Test with special characters',
          priority: 'low'
        }
      ];

      expect(() => {
        const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates.length).toBeGreaterThanOrEqual(0);

        // Candidate IDs should be safe for file names
        candidates.forEach(candidate => {
          expect(candidate.candidateId).toMatch(/^[a-zA-Z0-9-_]+$/);
        });
      }).not.toThrow();
    });
  });
});