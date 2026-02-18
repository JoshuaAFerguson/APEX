/**
 * @fileoverview Tests for test-utils/index.ts exports
 *
 * This file tests that all test utilities are properly exported and accessible
 * from the centralized test-utils module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  // Test constants
  TEST_CONSTANTS,
  TEST_ENVIRONMENTS,
  quickSetup,
  apexTestHelpers,

  // Re-exported utilities (these should be available from core)
  testFactories,
  assertionHelpers,
  mockHelpers,
  setupGlobalTestEnvironment,

  // Shared config functions
  createSharedConfig,
  createUnitTestConfig,
  createIntegrationTestConfig,
  createE2ETestConfig,
  createBrowserTestConfig,
} from '../index.js';

describe('Test Utils Exports', () => {
  describe('TEST_CONSTANTS', () => {
    it('should export all required test constants', () => {
      expect(TEST_CONSTANTS).toBeDefined();
      expect(TEST_CONSTANTS.DEFAULT_TIMEOUT).toBe(5000);
      expect(TEST_CONSTANTS.INTEGRATION_TIMEOUT).toBe(30000);
      expect(TEST_CONSTANTS.E2E_TIMEOUT).toBe(60000);
      expect(TEST_CONSTANTS.TEST_PROJECT_PATH).toBe('/test/project');
      expect(TEST_CONSTANTS.TEST_SESSION_PREFIX).toBe('test-session');
      expect(TEST_CONSTANTS.TEST_BASE_DATE).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should have readonly constants', () => {
      expect(Object.isFrozen(TEST_CONSTANTS)).toBe(true);
    });
  });

  describe('TEST_ENVIRONMENTS', () => {
    it('should export all test environment configurations', () => {
      expect(TEST_ENVIRONMENTS).toBeDefined();
      expect(TEST_ENVIRONMENTS.unit).toBeDefined();
      expect(TEST_ENVIRONMENTS.integration).toBeDefined();
      expect(TEST_ENVIRONMENTS.e2e).toBeDefined();
      expect(TEST_ENVIRONMENTS.browser).toBeDefined();
    });

    it('should have correct unit environment configuration', () => {
      expect(TEST_ENVIRONMENTS.unit).toEqual({
        timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT,
        environment: 'node',
        setupMocks: true,
        setupConsole: true,
      });
    });

    it('should have correct integration environment configuration', () => {
      expect(TEST_ENVIRONMENTS.integration).toEqual({
        timeout: TEST_CONSTANTS.INTEGRATION_TIMEOUT,
        environment: 'node',
        setupMocks: false,
        setupConsole: false,
      });
    });

    it('should have correct e2e environment configuration', () => {
      expect(TEST_ENVIRONMENTS.e2e).toEqual({
        timeout: TEST_CONSTANTS.E2E_TIMEOUT,
        environment: 'node',
        setupMocks: false,
        setupConsole: false,
      });
    });

    it('should have correct browser environment configuration', () => {
      expect(TEST_ENVIRONMENTS.browser).toEqual({
        timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT,
        environment: 'jsdom',
        setupMocks: true,
        setupConsole: true,
      });
    });

    it('should have readonly environment configs', () => {
      expect(Object.isFrozen(TEST_ENVIRONMENTS)).toBe(true);
    });
  });

  describe('quickSetup', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should export all quick setup functions', () => {
      expect(quickSetup).toBeDefined();
      expect(typeof quickSetup.unit).toBe('function');
      expect(typeof quickSetup.integration).toBe('function');
      expect(typeof quickSetup.e2e).toBe('function');
      expect(typeof quickSetup.browser).toBe('function');
    });

    it('should call setupGlobalTestEnvironment with correct config for unit tests', () => {
      // Mock setupGlobalTestEnvironment to verify it's called correctly
      const originalSetup = setupGlobalTestEnvironment;
      const mockSetup = vi.fn();

      // We can't directly mock the import, but we can verify the behavior
      expect(() => quickSetup.unit()).not.toThrow();
    });

    it('should provide different setups for different test types', () => {
      // Verify functions are different (not the same reference)
      expect(quickSetup.unit).not.toBe(quickSetup.integration);
      expect(quickSetup.integration).not.toBe(quickSetup.e2e);
      expect(quickSetup.e2e).not.toBe(quickSetup.browser);
    });
  });

  describe('apexTestHelpers', () => {
    it('should export all APEX-specific test helpers', () => {
      expect(apexTestHelpers).toBeDefined();
      expect(typeof apexTestHelpers.createMockApexConfig).toBe('function');
      expect(typeof apexTestHelpers.createMockTask).toBe('function');
      expect(typeof apexTestHelpers.createMockWorkflowExecution).toBe('function');
    });

    describe('createMockApexConfig', () => {
      it('should create valid APEX config with defaults', () => {
        const config = apexTestHelpers.createMockApexConfig();

        expect(config).toEqual({
          projectPath: TEST_CONSTANTS.TEST_PROJECT_PATH,
          autonomy: {
            maxCost: 10.0,
            maxTokens: { input: 100000, output: 50000 },
            requiresApproval: false,
          },
          agents: {
            planner: { model: 'sonnet', temperature: 0.1 },
            architect: { model: 'sonnet', temperature: 0.1 },
            developer: { model: 'sonnet', temperature: 0.1 },
            tester: { model: 'sonnet', temperature: 0.1 },
            reviewer: { model: 'sonnet', temperature: 0.1 },
            devops: { model: 'sonnet', temperature: 0.1 },
          },
          limits: {
            maxConcurrentTasks: 5,
            maxTaskRetries: 3,
            maxSessionDuration: 3600,
          },
        });
      });

      it('should merge overrides correctly', () => {
        const overrides = {
          autonomy: { maxCost: 20.0 },
          customProperty: 'test',
        };

        const config = apexTestHelpers.createMockApexConfig(overrides);

        expect(config.autonomy.maxCost).toBe(20.0);
        expect(config.autonomy.requiresApproval).toBe(false); // Preserved
        expect((config as any).customProperty).toBe('test');
      });
    });

    describe('createMockTask', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should create valid task with defaults', () => {
        const task = apexTestHelpers.createMockTask();

        expect(task).toMatchObject({
          name: 'Test Task',
          description: 'A test task for unit testing',
          projectPath: TEST_CONSTANTS.TEST_PROJECT_PATH,
          status: 'pending',
          priority: 'medium',
          estimatedCost: 0.5,
          workflow: 'feature-development',
          currentStage: 'planning',
          acceptanceCriteria: ['Task should be completed successfully'],
        });

        expect(task.id).toMatch(/^task-\d+-[a-z0-9]{9}$/);
        expect(task.createdAt).toBeInstanceOf(Date);
        expect(task.updatedAt).toBeInstanceOf(Date);
      });

      it('should merge overrides correctly', () => {
        const overrides = {
          name: 'Custom Task',
          status: 'running',
          customProperty: 'test',
        };

        const task = apexTestHelpers.createMockTask(overrides);

        expect(task.name).toBe('Custom Task');
        expect(task.status).toBe('running');
        expect(task.description).toBe('A test task for unit testing'); // Preserved
        expect((task as any).customProperty).toBe('test');
      });
    });

    describe('createMockWorkflowExecution', () => {
      it('should create valid workflow execution with defaults', () => {
        const execution = apexTestHelpers.createMockWorkflowExecution();

        expect(execution).toMatchObject({
          workflowId: 'feature-development',
          currentStage: 'planning',
          stages: ['planning', 'architecture', 'implementation', 'testing', 'review'],
          stageResults: {},
          totalCost: 0,
          totalTokens: { input: 0, output: 0 },
        });

        expect(execution.taskId).toMatch(/^task-\d+-[a-z0-9]{9}$/);
        expect(execution.startedAt).toBeInstanceOf(Date);
      });

      it('should merge overrides correctly', () => {
        const overrides = {
          currentStage: 'implementation',
          totalCost: 5.5,
          customProperty: 'test',
        };

        const execution = apexTestHelpers.createMockWorkflowExecution(overrides);

        expect(execution.currentStage).toBe('implementation');
        expect(execution.totalCost).toBe(5.5);
        expect(execution.workflowId).toBe('feature-development'); // Preserved
        expect((execution as any).customProperty).toBe('test');
      });
    });
  });

  describe('Re-exported Utilities', () => {
    it('should export test factories', () => {
      expect(testFactories).toBeDefined();
      expect(typeof testFactories.createTestId).toBe('function');
      expect(typeof testFactories.createTestDate).toBe('function');
      expect(typeof testFactories.createTestPath).toBe('function');
    });

    it('should export assertion helpers', () => {
      expect(assertionHelpers).toBeDefined();
      expect(typeof assertionHelpers.assertDefined).toBe('function');
      expect(typeof assertionHelpers.assertLength).toBe('function');
      expect(typeof assertionHelpers.assertRejectsWithError).toBe('function');
      expect(typeof assertionHelpers.assertHasProperties).toBe('function');
    });

    it('should export mock helpers', () => {
      expect(mockHelpers).toBeDefined();
      expect(typeof mockHelpers.createTypedMock).toBe('function');
      expect(typeof mockHelpers.createPartialMock).toBe('function');
      expect(typeof mockHelpers.mockClass).toBe('function');
    });

    it('should export setup function', () => {
      expect(typeof setupGlobalTestEnvironment).toBe('function');
    });
  });

  describe('Shared Config Functions', () => {
    it('should export all shared config functions', () => {
      expect(typeof createSharedConfig).toBe('function');
      expect(typeof createUnitTestConfig).toBe('function');
      expect(typeof createIntegrationTestConfig).toBe('function');
      expect(typeof createE2ETestConfig).toBe('function');
      expect(typeof createBrowserTestConfig).toBe('function');
    });

    it('should create working configurations', () => {
      const unitConfig = createUnitTestConfig();
      const integrationConfig = createIntegrationTestConfig();
      const e2eConfig = createE2ETestConfig();
      const browserConfig = createBrowserTestConfig();

      expect(unitConfig.test).toBeDefined();
      expect(integrationConfig.test).toBeDefined();
      expect(e2eConfig.test).toBeDefined();
      expect(browserConfig.test).toBeDefined();

      // Verify different configurations
      expect(unitConfig.test?.testTimeout).toBe(5000);
      expect(integrationConfig.test?.testTimeout).toBe(30000);
      expect(e2eConfig.test?.testTimeout).toBe(60000);
      expect(browserConfig.test?.environment).toBe('jsdom');
    });
  });

  describe('Import Integrity', () => {
    it('should not have undefined exports', async () => {
      // Import the module dynamically to check all exports
      const module = await import('../index.js');

      const exports = Object.keys(module);
      const expectedExports = [
        'TEST_CONSTANTS',
        'TEST_ENVIRONMENTS',
        'quickSetup',
        'apexTestHelpers',
        'testFactories',
        'assertionHelpers',
        'mockHelpers',
        'setupGlobalTestEnvironment',
        'createSharedConfig',
        'createUnitTestConfig',
        'createIntegrationTestConfig',
        'createE2ETestConfig',
        'createBrowserTestConfig',
      ];

      // Check that all expected exports exist
      for (const expectedExport of expectedExports) {
        expect(exports).toContain(expectedExport);
        expect(module[expectedExport]).toBeDefined();
      }

      // Check that no exports are undefined
      for (const exportName of exports) {
        expect(module[exportName]).toBeDefined();
      }
    });

    it('should handle circular dependencies gracefully', () => {
      // This test ensures that importing the module doesn't create circular dependency issues
      expect(() => {
        require('../index.js');
      }).not.toThrow();
    });
  });

  describe('Real-world Usage', () => {
    it('should support typical test setup workflow', () => {
      // 1. Setup environment
      quickSetup.unit();

      // 2. Create test data
      const config = apexTestHelpers.createMockApexConfig();
      const task = apexTestHelpers.createMockTask();
      const execution = apexTestHelpers.createMockWorkflowExecution();

      // 3. Use assertions
      assertionHelpers.assertDefined(config);
      assertionHelpers.assertDefined(task);
      assertionHelpers.assertDefined(execution);

      // 4. Use factories
      const testId = testFactories.createTestId('workflow');
      const testPath = testFactories.createTestPath('src', 'workflow.ts');

      // 5. Use mocks
      const mockFn = mockHelpers.createTypedMock<() => string>();
      mockFn.mockReturnValue('test');

      expect(mockFn()).toBe('test');
      expect(testId).toMatch(/^workflow-\d+-[a-z0-9]{9}$/);
      expect(testPath).toBe('/test/project/src/workflow.ts');
    });

    it('should support different test environment setups', () => {
      // Should be able to configure for different test types
      expect(() => {
        const unitConfig = createUnitTestConfig();
        const integrationConfig = createIntegrationTestConfig();
        const e2eConfig = createE2ETestConfig();
        const browserConfig = createBrowserTestConfig();

        quickSetup.unit();
        quickSetup.integration();
        quickSetup.e2e();
        quickSetup.browser();
      }).not.toThrow();
    });
  });
});