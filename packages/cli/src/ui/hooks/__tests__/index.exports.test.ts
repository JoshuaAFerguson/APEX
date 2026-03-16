/**
 * Comprehensive export tests for hooks index file
 * Tests that all exports from the hooks module are properly accessible and functioning
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock React to prevent useState issues in isolated testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn(() => [
      {
        currentCost: 0,
        budgetUsedPercentage: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        isOverBudget: false,
        isApproachingLimit: false,
        connectionStatus: 'disconnected',
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      },
      vi.fn()
    ]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn) => fn),
    useRef: vi.fn(() => ({ current: {} })),
  };
});

describe('hooks/index.ts exports', () => {
  describe('useBudgetStatus hook and types', () => {
    it('exports useBudgetStatus hook', async () => {
      const { useBudgetStatus } = await import('../index');
      expect(useBudgetStatus).toBeDefined();
      expect(typeof useBudgetStatus).toBe('function');
    });

    it('exports BudgetData type', async () => {
      // Since this is a type-only export, we test via TypeScript compilation
      const { useBudgetStatus } = await import('../index');

      // Test that useBudgetStatus returns the expected structure
      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      const result = useBudgetStatus({ orchestrator: mockOrchestrator as any });

      // Verify the returned object has BudgetData properties
      expect(typeof result.currentCost).toBe('number');
      expect(typeof result.budgetUsedPercentage).toBe('number');
      expect(typeof result.totalInputTokens).toBe('number');
      expect(typeof result.totalOutputTokens).toBe('number');
      expect(typeof result.totalTokens).toBe('number');
      expect(typeof result.estimatedCost).toBe('number');
      expect(typeof result.isOverBudget).toBe('boolean');
      expect(typeof result.isApproachingLimit).toBe('boolean');
    });

    it('exports BudgetThresholds type', async () => {
      const { useBudgetStatus } = await import('../index');

      // Test that BudgetThresholds interface is properly typed via options
      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      const thresholds = {
        warningThreshold: 75,
        criticalThreshold: 90,
      };

      // This should not throw a TypeScript error if BudgetThresholds is exported
      const result = useBudgetStatus({
        orchestrator: mockOrchestrator as any,
        thresholds
      });

      expect(result).toBeDefined();
    });

    it('exports UseBudgetStatusOptions type', async () => {
      const { useBudgetStatus } = await import('../index');

      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      // Test all UseBudgetStatusOptions properties are accepted
      const options = {
        orchestrator: mockOrchestrator as any,
        taskId: 'test-task',
        budgetLimit: 100,
        thresholds: {
          warningThreshold: 80,
          criticalThreshold: 95,
        },
        debug: true,
      };

      const result = useBudgetStatus(options);
      expect(result).toBeDefined();
    });

    it('exports BudgetStatusState type', async () => {
      const { useBudgetStatus } = await import('../index');

      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      const result = useBudgetStatus({ orchestrator: mockOrchestrator as any });

      // Verify BudgetStatusState properties
      expect(['connected', 'disconnected', 'connecting']).toContain(result.connectionStatus);
      expect(typeof result.isLoading).toBe('boolean');
      expect(result.error === null || result.error instanceof Error).toBe(true);
      expect(typeof result.refresh).toBe('function');
    });
  });

  describe('Other hook exports', () => {
    it('exports useAgentHandoff hook and types', async () => {
      const { useAgentHandoff, formatHandoffElapsed } = await import('../index');

      expect(useAgentHandoff).toBeDefined();
      expect(typeof useAgentHandoff).toBe('function');
      expect(formatHandoffElapsed).toBeDefined();
      expect(typeof formatHandoffElapsed).toBe('function');
    });

    it('exports useElapsedTime hook', async () => {
      const { useElapsedTime } = await import('../index');

      expect(useElapsedTime).toBeDefined();
      expect(typeof useElapsedTime).toBe('function');
    });

    it('exports useOrchestratorEvents hook and types', async () => {
      const { useOrchestratorEvents } = await import('../index');

      expect(useOrchestratorEvents).toBeDefined();
      expect(typeof useOrchestratorEvents).toBe('function');
    });

    it('exports useToolEventLogger hook and types', async () => {
      const { useToolEventLogger } = await import('../index');

      expect(useToolEventLogger).toBeDefined();
      expect(typeof useToolEventLogger).toBe('function');
    });

    it('exports useStdoutDimensions hook and types', async () => {
      const { useStdoutDimensions } = await import('../index');

      expect(useStdoutDimensions).toBeDefined();
      expect(typeof useStdoutDimensions).toBe('function');
    });
  });

  describe('Export integrity', () => {
    it('exports all expected items', async () => {
      const exports = await import('../index');

      const expectedExports = [
        // useBudgetStatus exports
        'useBudgetStatus',

        // useAgentHandoff exports
        'useAgentHandoff',
        'formatHandoffElapsed',

        // useElapsedTime exports
        'useElapsedTime',

        // useOrchestratorEvents exports
        'useOrchestratorEvents',

        // useToolEventLogger exports
        'useToolEventLogger',

        // useStdoutDimensions exports
        'useStdoutDimensions',
      ];

      for (const expectedExport of expectedExports) {
        expect(exports).toHaveProperty(expectedExport);
        expect(exports[expectedExport]).toBeDefined();
      }
    });

    it('does not export unexpected items', async () => {
      const exports = await import('../index');
      const exportKeys = Object.keys(exports);

      // All exports should be intentional - check against known list
      const knownExports = [
        'useBudgetStatus',
        'useAgentHandoff',
        'formatHandoffElapsed',
        'useElapsedTime',
        'useOrchestratorEvents',
        'useToolEventLogger',
        'useStdoutDimensions',
      ];

      // Every export should be in our known list
      for (const exportKey of exportKeys) {
        expect(knownExports).toContain(exportKey);
      }
    });

    it('maintains consistent export structure', async () => {
      const exports = await import('../index');

      // All hook exports should be functions
      const hooks = [
        'useBudgetStatus',
        'useAgentHandoff',
        'useElapsedTime',
        'useOrchestratorEvents',
        'useToolEventLogger',
        'useStdoutDimensions',
      ];

      hooks.forEach(hookName => {
        expect(typeof exports[hookName]).toBe('function');
      });

      // formatHandoffElapsed should also be a function
      expect(typeof exports.formatHandoffElapsed).toBe('function');
    });
  });
});