/**
 * Remediation Suggestions Tests for TestsAnalyzer
 *
 * Tests for comprehensive remediation suggestions including:
 * - Integration test setup instructions
 * - Environment configuration
 * - Template generation
 * - Critical path type detection
 * - Infrastructure setup guidance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestsAnalyzer } from '../tests-analyzer';
import type { ProjectAnalysis } from '../../idle-processor';

describe('TestsAnalyzer - Remediation Suggestions', () => {
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

  describe('Authentication Integration Test Setup Suggestions', () => {
    it('should provide comprehensive authentication setup instructions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'JWT Authentication Flow',
          description: 'Token-based authentication system',
          priority: 'critical',
          relatedFiles: ['src/auth/jwt.service.ts', 'src/middleware/auth.middleware.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const authTask = candidates.find(c => c.candidateId.includes('JWT-Authentication-Flow'));

      expect(authTask).toBeDefined();

      const suggestions = authTask?.remediationSuggestions || [];

      // Should have authentication environment setup
      const authSetupSuggestion = suggestions.find(s =>
        s.type === 'testing' && s.description.includes('Set up authentication test environment')
      );
      expect(authSetupSuggestion).toBeDefined();
      expect(authSetupSuggestion?.priority).toBe('high');
      expect(authSetupSuggestion?.expectedOutcome).toContain('Test environment configured');
      expect(authSetupSuggestion?.command).toContain('JWT_SECRET');
      expect(authSetupSuggestion?.command).toContain('generateTestToken');
      expect(authSetupSuggestion?.command).toContain('createTestUser');

      // Should have security boundaries review
      const securityReviewSuggestion = suggestions.find(s =>
        s.description.includes('Review security boundaries')
      );
      expect(securityReviewSuggestion).toBeDefined();
      expect(securityReviewSuggestion?.priority).toBe('high');
      expect(securityReviewSuggestion?.warning).toContain('Security-critical');
      expect(securityReviewSuggestion?.expectedOutcome).toContain('authentication scenarios');

      // Should include JWT-specific test template
      const templateSuggestion = suggestions.find(s =>
        s.command && s.command.includes('Authentication Integration')
      );
      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('supertest');
      expect(templateSuggestion?.command).toContain('Authorization');
      expect(templateSuggestion?.command).toContain('Bearer');
    });

    it('should include authentication helper functions in setup', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'OAuth2 Integration',
          description: 'Third-party OAuth authentication',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const oauthTask = candidates.find(c => c.candidateId.includes('OAuth2-Integration'));

      const suggestions = oauthTask?.remediationSuggestions || [];
      const setupSuggestion = suggestions.find(s => s.command?.includes('generateTestToken'));

      expect(setupSuggestion).toBeDefined();
      expect(setupSuggestion?.command).toContain('createTestUser');
      expect(setupSuggestion?.command).toContain('cleanupTestUser');
      expect(setupSuggestion?.command).toContain('vitest.config.ts');
    });
  });

  describe('Payment Integration Test Setup Suggestions', () => {
    it('should provide comprehensive payment setup with Stripe test mode', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Credit Card Payment Flow',
          description: 'Stripe payment processing integration',
          priority: 'critical',
          relatedFiles: ['src/payment/stripe.service.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const paymentTask = candidates.find(c => c.candidateId.includes('Credit-Card-Payment-Flow'));

      const suggestions = paymentTask?.remediationSuggestions || [];

      // Should have payment environment setup
      const paymentSetupSuggestion = suggestions.find(s =>
        s.description.includes('Set up payment test environment')
      );
      expect(paymentSetupSuggestion).toBeDefined();
      expect(paymentSetupSuggestion?.priority).toBe('high');
      expect(paymentSetupSuggestion?.command).toContain('STRIPE_TEST_SECRET_KEY');
      expect(paymentSetupSuggestion?.command).toContain('TEST_CARDS');
      expect(paymentSetupSuggestion?.command).toContain('createTestCustomer');

      // Should have payment scenarios testing
      const scenarioSuggestion = suggestions.find(s =>
        s.description.includes('payment scenarios')
      );
      expect(scenarioSuggestion).toBeDefined();
      expect(scenarioSuggestion?.priority).toBe('critical');
      expect(scenarioSuggestion?.expectedOutcome).toContain('payment flows thoroughly tested');
      expect(scenarioSuggestion?.warning).toContain('financial losses');

      // Should include Stripe-specific test template
      const templateSuggestion = suggestions.find(s =>
        s.command && s.command.includes('Payment Integration')
      );
      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('4242424242424242'); // Stripe test card
      expect(templateSuggestion?.command).toContain('paymentMethods.create');
      expect(templateSuggestion?.command).toContain('webhooks');
    });

    it('should include payment safety guidelines and test card numbers', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Subscription Billing System',
          description: 'Recurring payment processing',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const subscriptionTask = candidates.find(c => c.candidateId.includes('Subscription-Billing-System'));

      const suggestions = subscriptionTask?.remediationSuggestions || [];
      const setupSuggestion = suggestions.find(s => s.command?.includes('STRIPE_TEST_SECRET_KEY'));

      expect(setupSuggestion).toBeDefined();
      expect(setupSuggestion?.command).toContain('VALID: \'4242424242424242\'');
      expect(setupSuggestion?.command).toContain('DECLINED: \'4000000000000002\'');
      expect(setupSuggestion?.command).toContain('Safety Guidelines');
      expect(setupSuggestion?.command).toContain('ALWAYS use test mode keys');
    });
  });

  describe('Data Processing Integration Test Setup Suggestions', () => {
    it('should provide data processing test infrastructure setup', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'CSV Import Processing',
          description: 'Large-scale CSV data import and validation',
          priority: 'critical',
          relatedFiles: ['src/import/csv.service.ts', 'src/validation/data.validator.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const csvTask = candidates.find(c => c.candidateId.includes('CSV-Import-Processing'));

      const suggestions = csvTask?.remediationSuggestions || [];

      // Should have data fixtures setup
      const dataSetupSuggestion = suggestions.find(s =>
        s.description.includes('Set up test data fixtures')
      );
      expect(dataSetupSuggestion).toBeDefined();
      expect(dataSetupSuggestion?.priority).toBe('medium');
      expect(dataSetupSuggestion?.command).toContain('transformation pipelines');
      expect(dataSetupSuggestion?.command).toContain('test-data');

      // Should include data-specific template
      const templateSuggestion = suggestions.find(s =>
        s.command && s.command.includes('Data Processing Integration')
      );
      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('importCsvData');
      expect(templateSuggestion?.command).toContain('transformUserData');
      expect(templateSuggestion?.command).toContain('exportToPdf');
    });

    it('should include performance testing utilities for data processing', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'High-Volume Data Processing',
          description: 'Performance testing for large datasets',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const perfTask = candidates.find(c => c.candidateId.includes('High-Volume-Data-Processing'));

      const suggestions = perfTask?.remediationSuggestions || [];
      const setupSuggestion = suggestions.find(s => s.command?.includes('Data Processing Integration'));

      expect(setupSuggestion).toBeDefined();
      expect(setupSuggestion?.command).toContain('PerformanceTracker');
      expect(setupSuggestion?.command).toContain('expectExecutionTime');
      expect(setupSuggestion?.command).toContain('testTimeout: 30000');
    });
  });

  describe('API Endpoint Integration Test Setup Suggestions', () => {
    it('should provide comprehensive API testing setup', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'REST API Endpoints',
          description: 'Complete API endpoint testing suite',
          priority: 'high',
          relatedFiles: ['src/api/controllers/user.controller.ts', 'src/api/routes/user.routes.ts']
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const apiTask = candidates.find(c => c.candidateId.includes('REST-API-Endpoints'));

      const suggestions = apiTask?.remediationSuggestions || [];
      const templateSuggestion = suggestions.find(s =>
        s.command && s.command.includes('API Integration')
      );

      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('CRUD operations');
      expect(templateSuggestion?.command).toContain('pagination');
      expect(templateSuggestion?.command).toContain('error handling');
      expect(templateSuggestion?.command).toContain('unauthorized requests');
    });
  });

  describe('Database Integration Test Setup Suggestions', () => {
    it('should provide database-specific testing infrastructure', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Database Transaction Management',
          description: 'Complex database operations with transactions',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const dbTask = candidates.find(c => c.candidateId.includes('Database-Transaction-Management'));

      const suggestions = dbTask?.remediationSuggestions || [];
      const templateSuggestion = suggestions.find(s =>
        s.command && s.command.includes('Database Integration')
      );

      expect(templateSuggestion).toBeDefined();
      expect(templateSuggestion?.command).toContain('transaction');
      expect(templateSuggestion?.command).toContain('rollback');
      expect(templateSuggestion?.command).toContain('constraints');
      expect(templateSuggestion?.command).toContain('optimistic locking');
    });
  });

  describe('Integration Test Infrastructure Setup', () => {
    it('should provide comprehensive infrastructure setup instructions', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'End-to-End User Journey',
          description: 'Complete user workflow testing',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const e2eTask = candidates.find(c => c.candidateId.includes('End-to-End-User-Journey'));

      const suggestions = e2eTask?.remediationSuggestions || [];
      const infrastructureSuggestion = suggestions.find(s =>
        s.description.includes('Configure integration test infrastructure')
      );

      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('setupTestDatabase');
      expect(infrastructureSuggestion?.command).toContain('teardownTestDatabase');
      expect(infrastructureSuggestion?.command).toContain('docker-compose.test.yml');
      expect(infrastructureSuggestion?.command).toContain('vitest.integration.config.ts');
    });

    it('should include Docker setup for isolated test environment', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Microservices Integration',
          description: 'Multi-service integration testing',
          priority: 'high'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const microTask = candidates.find(c => c.candidateId.includes('Microservices-Integration'));

      const suggestions = microTask?.remediationSuggestions || [];
      const infrastructureSuggestion = suggestions.find(s =>
        s.command && s.command.includes('docker-compose')
      );

      expect(infrastructureSuggestion).toBeDefined();
      expect(infrastructureSuggestion?.command).toContain('test-db');
      expect(infrastructureSuggestion?.command).toContain('test-redis');
      expect(infrastructureSuggestion?.command).toContain('tmpfs');
      expect(infrastructureSuggestion?.command).toContain('test:db:setup');
    });
  });

  describe('Critical Path Type Detection', () => {
    it('should correctly detect authentication-related paths', () => {
      const analyzer = testsAnalyzer as any; // Access private method for testing

      expect(analyzer.detectCriticalPathType('User Authentication System')).toBe('authentication');
      expect(analyzer.detectCriticalPathType('JWT Token Validation')).toBe('authentication');
      expect(analyzer.detectCriticalPathType('OAuth Login Integration')).toBe('authentication');
      expect(analyzer.detectCriticalPathType('Multi-factor Authentication')).toBe('authentication');
    });

    it('should correctly detect payment-related paths', () => {
      const analyzer = testsAnalyzer as any;

      expect(analyzer.detectCriticalPathType('Payment Processing Flow')).toBe('payment');
      expect(analyzer.detectCriticalPathType('Stripe Billing Integration')).toBe('payment');
      expect(analyzer.detectCriticalPathType('Transaction Management')).toBe('payment');
      expect(analyzer.detectCriticalPathType('Subscription Billing')).toBe('payment');
    });

    it('should correctly detect data processing-related paths', () => {
      const analyzer = testsAnalyzer as any;

      expect(analyzer.detectCriticalPathType('Data Processing Pipeline')).toBe('data_processing');
      expect(analyzer.detectCriticalPathType('CSV Import System')).toBe('data_processing');
      expect(analyzer.detectCriticalPathType('Data Export Functionality')).toBe('data_processing');
      expect(analyzer.detectCriticalPathType('Data Transformation Engine')).toBe('data_processing');
    });

    it('should correctly detect API endpoint paths', () => {
      const analyzer = testsAnalyzer as any;

      expect(analyzer.detectCriticalPathType('REST API Endpoint Testing')).toBe('api_endpoint');
      expect(analyzer.detectCriticalPathType('GraphQL API Endpoints')).toBe('api_endpoint');
    });

    it('should correctly detect database paths', () => {
      const analyzer = testsAnalyzer as any;

      expect(analyzer.detectCriticalPathType('Database Migration System')).toBe('database');
      expect(analyzer.detectCriticalPathType('Complex Query Performance')).toBe('database');
    });

    it('should fall back to general type for unrecognized paths', () => {
      const analyzer = testsAnalyzer as any;

      expect(analyzer.detectCriticalPathType('Unknown System Component')).toBe('general');
      expect(analyzer.detectCriticalPathType('Custom Business Logic')).toBe('general');
    });
  });

  describe('Template Generation Quality', () => {
    it('should generate production-quality authentication test templates', () => {
      const analyzer = testsAnalyzer as any;
      const testData = {
        criticalPath: 'User Login Flow',
        description: 'Complete authentication workflow',
        priority: 'critical' as const
      };

      const template = analyzer.generateAuthIntegrationTemplate(
        'integration/user-login.integration.test.ts',
        testData
      );

      expect(template).toContain('beforeEach(async () => {');
      expect(template).toContain('afterEach(async () => {');
      expect(template).toContain('createTestUser()');
      expect(template).toContain('generateTestToken(testUser.id)');
      expect(template).toContain('cleanupTestUser(testUser.id)');
      expect(template).toContain('should authenticate valid user credentials');
      expect(template).toContain('should reject invalid credentials');
      expect(template).toContain('should protect authenticated routes');
      expect(template).toContain('should handle token refresh correctly');
      expect(template).toContain('should handle logout and session cleanup');
    });

    it('should generate comprehensive payment test templates with Stripe integration', () => {
      const analyzer = testsAnalyzer as any;
      const testData = {
        criticalPath: 'Payment Processing',
        description: 'Stripe payment integration',
        priority: 'critical' as const
      };

      const template = analyzer.generatePaymentIntegrationTemplate(
        'integration/payment.integration.test.ts',
        testData
      );

      expect(template).toContain('import Stripe from \'stripe\'');
      expect(template).toContain('STRIPE_TEST_SECRET_KEY');
      expect(template).toContain('4242424242424242'); // Valid test card
      expect(template).toContain('4000000000000002'); // Declined test card
      expect(template).toContain('should process successful payment');
      expect(template).toContain('should handle payment failures gracefully');
      expect(template).toContain('should process refunds correctly');
      expect(template).toContain('should handle payment success webhooks');
    });

    it('should generate comprehensive data processing templates', () => {
      const analyzer = testsAnalyzer as any;
      const testData = {
        criticalPath: 'CSV Data Import',
        description: 'Bulk data import processing',
        priority: 'high' as const
      };

      const template = analyzer.generateDataProcessingIntegrationTemplate(
        'integration/csv-import.integration.test.ts',
        testData
      );

      expect(template).toContain('should import CSV data correctly');
      expect(template).toContain('should handle malformed CSV data gracefully');
      expect(template).toContain('should transform data according to business rules');
      expect(template).toContain('should validate data during transformation');
      expect(template).toContain('should export data to PDF correctly');
    });
  });

  describe('Remediation Suggestion Formatting and Quality', () => {
    it('should format remediation suggestions with proper structure', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Security Authentication Flow',
          description: 'Critical security validation',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const securityTask = candidates.find(c => c.candidateId.includes('Security-Authentication-Flow'));

      const suggestions = securityTask?.remediationSuggestions || [];

      // All suggestions should have required fields
      suggestions.forEach(suggestion => {
        expect(suggestion.type).toBeDefined();
        expect(['testing', 'manual_review', 'command', 'documentation'].includes(suggestion.type)).toBe(true);
        expect(suggestion.description).toBeDefined();
        expect(suggestion.priority).toBeDefined();
        expect(suggestion.expectedOutcome).toBeDefined();
      });

      // Critical security suggestions should have warnings
      const securitySuggestions = suggestions.filter(s => s.warning);
      expect(securitySuggestions.length).toBeGreaterThan(0);
    });

    it('should prioritize suggestions appropriately', () => {
      baseProjectAnalysis.testAnalysis.missingIntegrationTests = [
        {
          criticalPath: 'Financial Transaction Validation',
          description: 'Money transfer security',
          priority: 'critical'
        }
      ];

      const candidates = testsAnalyzer.analyze(baseProjectAnalysis);
      const financialTask = candidates.find(c => c.candidateId.includes('Financial-Transaction-Validation'));

      const suggestions = financialTask?.remediationSuggestions || [];

      // Should have urgent primary suggestion
      const urgentSuggestions = suggestions.filter(s => s.priority === 'urgent');
      expect(urgentSuggestions.length).toBeGreaterThan(0);

      // Should have critical security warnings
      const criticalSuggestions = suggestions.filter(s => s.priority === 'critical');
      expect(criticalSuggestions.length).toBeGreaterThan(0);
    });
  });
});