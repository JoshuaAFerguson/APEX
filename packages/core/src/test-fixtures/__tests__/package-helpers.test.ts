/**
 * @fileoverview Tests for Package-Specific Test Suite Helpers
 *
 * Validates that the package-specific helpers correctly configure test environments
 * and provide the expected functionality for each package type.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createCLITestSuite,
  createOrchestratorTestSuite,
  createCoreTestSuite,
  createTimerTestSuite,
  getTestEnvironment,
  setTestData,
  getTestData,
  advanceTimers,
} from '../package-helpers.js';

describe('Package-Specific Test Suite Helpers', () => {
  describe('createCLITestSuite()', () => {
    it('should create a suite with file system mocking enabled', async () => {
      const suite = createCLITestSuite({
        mockFileSystem: {
          '/test/.apex/config.yaml': 'project: test-project',
        },
      });

      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.projectPath).toBe('/test/project');

      await suite.afterEach();
    });

    it('should accept custom environment variables', async () => {
      const suite = createCLITestSuite({
        mockEnvVars: {
          CUSTOM_VAR: 'custom-value',
        },
      });

      await suite.beforeEach();

      // Environment variables are set up via vi.stubEnv in setupTestMocks
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.APEX_PROJECT_PATH).toBe('/test/project');

      await suite.afterEach();
    });

    it('should run custom setup and teardown', async () => {
      const setupSpy = vi.fn();
      const teardownSpy = vi.fn();

      const suite = createCLITestSuite({
        customSetup: setupSpy,
        customTeardown: teardownSpy,
      });

      await suite.beforeEach();
      await suite.afterEach();

      expect(setupSpy).toHaveBeenCalledOnce();
      expect(teardownSpy).toHaveBeenCalledOnce();
    });
  });

  describe('createOrchestratorTestSuite()', () => {
    it('should create a suite with network mocking and longer timeout', async () => {
      const suite = createOrchestratorTestSuite({
        mockAgents: ['planner', 'developer'],
        timeout: 90000,
      });

      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      // Verify mocked agents are registered
      expect(env!.activeMocks.has('planner')).toBe(true);
      expect(env!.activeMocks.has('developer')).toBe(true);
      expect(env!.activeMocks.has('taskStore')).toBe(true);
      expect(env!.activeMocks.has('claudeSDK')).toBe(true);

      await suite.afterEach();
    });

    it('should accept custom API response mocking', async () => {
      const suite = createOrchestratorTestSuite({
        mockApiResponses: {
          '/api/test': { success: true },
        },
      });

      await suite.beforeEach();
      await suite.afterEach();
    });
  });

  describe('createCoreTestSuite()', () => {
    it('should create a minimal suite for pure logic tests', async () => {
      const suite = createCoreTestSuite();

      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();

      // Should have minimal setup - no mocks by default
      expect(env!.activeMocks.size).toBe(0);

      await suite.afterEach();
    });

    it('should optionally enable mocks', async () => {
      const suite = createCoreTestSuite({
        enableMocks: true,
      });

      await suite.beforeEach();
      await suite.afterEach();
    });
  });

  describe('createTimerTestSuite()', () => {
    it('should create a suite with fake timers enabled', async () => {
      const suite = createTimerTestSuite();

      await suite.beforeEach();

      // Test that fake timers are working
      const callback = vi.fn();
      setTimeout(callback, 1000);

      expect(callback).not.toHaveBeenCalled();
      await advanceTimers(1000);
      expect(callback).toHaveBeenCalled();

      await suite.afterEach();
    });
  });

  describe('Integration: Complete test lifecycle', () => {
    it('should support CLI test pattern end-to-end', async () => {
      const suite = createCLITestSuite({
        mockFileSystem: {
          '/test/data.json': '{"users": []}',
        },
        customSetup: () => {
          setTestData('initialized', true);
        },
      });

      await suite.beforeEach();

      // Verify test environment is set up
      expect(getTestData('initialized')).toBe(true);

      // Verify test isolation
      setTestData('testSpecificData', 'test-value');
      expect(getTestData('testSpecificData')).toBe('test-value');

      await suite.afterEach();

      // After teardown, environment should be clean
      expect(getTestEnvironment()).toBeNull();
    });

    it('should isolate state between different suite types', async () => {
      // First suite - CLI
      const cliSuite = createCLITestSuite();
      await cliSuite.beforeEach();
      setTestData('suiteType', 'cli');
      expect(getTestData('suiteType')).toBe('cli');
      await cliSuite.afterEach();

      // Second suite - Orchestrator (clean state)
      const orchestratorSuite = createOrchestratorTestSuite();
      await orchestratorSuite.beforeEach();
      expect(getTestData('suiteType')).toBeUndefined();
      setTestData('suiteType', 'orchestrator');
      expect(getTestData('suiteType')).toBe('orchestrator');
      await orchestratorSuite.afterEach();
    });
  });
});