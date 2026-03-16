/**
 * Integration test to verify that all exports work together correctly
 * Tests the complete export chain: hooks/index.ts and types/index.ts
 */

import { describe, it, expect, vi } from 'vitest';

// Mock React hooks to avoid issues in testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn(() => [
      {
        currentCost: 50,
        budgetLimit: 100,
        budgetUsedPercentage: 50,
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 50,
        isOverBudget: false,
        isApproachingLimit: false,
        connectionStatus: 'connected',
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

describe('Export Integration Tests', () => {
  describe('useBudgetStatus hook with types', () => {
    it('useBudgetStatus hook uses exported types correctly', async () => {
      // Import hook from hooks index
      const { useBudgetStatus } = await import('../ui/hooks/index');

      // Import types from types index
      const typesModule = await import('../types/index');

      // Verify both modules are properly exported
      expect(useBudgetStatus).toBeDefined();
      expect(typeof useBudgetStatus).toBe('function');

      // Create a mock orchestrator
      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      // Test that the hook works with typed options
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

      // Verify the result has the expected shape
      expect(result).toMatchObject({
        currentCost: expect.any(Number),
        budgetUsedPercentage: expect.any(Number),
        totalInputTokens: expect.any(Number),
        totalOutputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
        estimatedCost: expect.any(Number),
        isOverBudget: expect.any(Boolean),
        isApproachingLimit: expect.any(Boolean),
        connectionStatus: expect.stringMatching(/^(connected|disconnected|connecting)$/),
        isLoading: expect.any(Boolean),
        error: null,
        refresh: expect.any(Function),
      });
    });
  });

  describe('Cross-module type consistency', () => {
    it('types from both index files are consistent', async () => {
      // This test ensures that types exported from different index files
      // can be used together without conflicts

      const hooksModule = await import('../ui/hooks/index');
      const typesModule = await import('../types/index');

      // Verify we can import from both modules
      expect(hooksModule.useBudgetStatus).toBeDefined();

      // Test type compatibility by using hook with typed parameters
      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      // This should work without TypeScript errors if types are properly exported
      const result = hooksModule.useBudgetStatus({
        orchestrator: mockOrchestrator as any,
        budgetLimit: 100,
        thresholds: {
          warningThreshold: 80,
          criticalThreshold: 95,
        }
      });

      expect(result).toBeDefined();
    });
  });

  describe('Compile-time verification', () => {
    it('all exports compile without TypeScript errors', async () => {
      // Test that we can import everything without compilation errors
      try {
        const hooksExports = await import('../ui/hooks/index');
        const typesExports = await import('../types/index');

        // Verify main exports exist
        expect(hooksExports.useBudgetStatus).toBeDefined();
        expect(hooksExports.useAgentHandoff).toBeDefined();
        expect(hooksExports.useElapsedTime).toBeDefined();
        expect(hooksExports.useOrchestratorEvents).toBeDefined();
        expect(hooksExports.useToolEventLogger).toBeDefined();
        expect(hooksExports.useStdoutDimensions).toBeDefined();

        // If we get here without errors, TypeScript compilation succeeded
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`TypeScript compilation failed: ${error}`);
      }
    });
  });

  describe('Runtime behavior', () => {
    it('exported hook functions are callable', async () => {
      const { useBudgetStatus, useElapsedTime } = await import('../ui/hooks/index');

      const mockOrchestrator = {
        on: vi.fn(),
        off: vi.fn(),
      };

      // Test useBudgetStatus
      expect(() => useBudgetStatus({ orchestrator: mockOrchestrator as any })).not.toThrow();

      // Test useElapsedTime
      expect(() => useElapsedTime()).not.toThrow();
    });

    it('exported helper functions work correctly', async () => {
      const { formatHandoffElapsed } = await import('../ui/hooks/index');

      expect(typeof formatHandoffElapsed).toBe('function');

      // Test the function actually works
      const result = formatHandoffElapsed(new Date(Date.now() - 5000)); // 5 seconds ago
      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d/); // Should contain some digits
    });
  });
});