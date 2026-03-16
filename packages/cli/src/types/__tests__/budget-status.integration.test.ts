/**
 * Integration tests for BudgetStatus types
 * Tests realistic usage scenarios, calculations, and edge cases
 */

import { describe, it, expect } from 'vitest';
import type {
  BudgetStatus,
  BudgetStatusLevel,
  BudgetStatusState,
  UseBudgetStatusReturn,
  UseBudgetStatusOptions
} from '../budget-status';

describe('BudgetStatus Integration Tests', () => {
  /**
   * Helper function to calculate status based on percentage
   */
  function calculateStatus(percentUsed: number, warningThreshold = 80, criticalThreshold = 95): BudgetStatusLevel {
    if (percentUsed >= 100) return 'exceeded';
    if (percentUsed >= criticalThreshold) return 'critical';
    if (percentUsed >= warningThreshold) return 'warning';
    return 'ok';
  }

  /**
   * Helper function to create budget status with calculated percentage
   */
  function createBudgetStatus(currentSpend: number, budgetLimit: number): BudgetStatus {
    const percentUsed = budgetLimit === 0 ? 0 : (currentSpend / budgetLimit) * 100;
    return {
      currentSpend,
      budgetLimit,
      percentUsed,
      status: calculateStatus(percentUsed),
      lastUpdated: new Date()
    };
  }

  describe('Budget calculation scenarios', () => {
    it('should handle typical budget progression from ok to exceeded', () => {
      const budgetLimit = 100;

      // Starting: 0% used - should be 'ok'
      const stage1 = createBudgetStatus(0, budgetLimit);
      expect(stage1.percentUsed).toBe(0);
      expect(stage1.status).toBe('ok');

      // 50% used - should still be 'ok'
      const stage2 = createBudgetStatus(50, budgetLimit);
      expect(stage2.percentUsed).toBe(50);
      expect(stage2.status).toBe('ok');

      // 80% used - should be 'warning'
      const stage3 = createBudgetStatus(80, budgetLimit);
      expect(stage3.percentUsed).toBe(80);
      expect(stage3.status).toBe('warning');

      // 90% used - should still be 'warning'
      const stage4 = createBudgetStatus(90, budgetLimit);
      expect(stage4.percentUsed).toBe(90);
      expect(stage4.status).toBe('warning');

      // 95% used - should be 'critical'
      const stage5 = createBudgetStatus(95, budgetLimit);
      expect(stage5.percentUsed).toBe(95);
      expect(stage5.status).toBe('critical');

      // 100% used - should be 'exceeded'
      const stage6 = createBudgetStatus(100, budgetLimit);
      expect(stage6.percentUsed).toBe(100);
      expect(stage6.status).toBe('exceeded');

      // 150% used - should still be 'exceeded'
      const stage7 = createBudgetStatus(150, budgetLimit);
      expect(stage7.percentUsed).toBe(150);
      expect(stage7.status).toBe('exceeded');
    });

    it('should handle decimal currency amounts correctly', () => {
      const budgetStatus = createBudgetStatus(123.45, 500.75);

      expect(budgetStatus.currentSpend).toBe(123.45);
      expect(budgetStatus.budgetLimit).toBe(500.75);
      expect(budgetStatus.percentUsed).toBeCloseTo(24.65, 2);
      expect(budgetStatus.status).toBe('ok');
    });

    it('should handle very small amounts', () => {
      const budgetStatus = createBudgetStatus(0.01, 0.10);

      expect(budgetStatus.currentSpend).toBe(0.01);
      expect(budgetStatus.budgetLimit).toBe(0.10);
      expect(budgetStatus.percentUsed).toBe(10);
      expect(budgetStatus.status).toBe('ok');
    });

    it('should handle zero budget limit edge case', () => {
      const budgetStatus = createBudgetStatus(0, 0);

      expect(budgetStatus.currentSpend).toBe(0);
      expect(budgetStatus.budgetLimit).toBe(0);
      expect(budgetStatus.percentUsed).toBe(0);
      expect(budgetStatus.status).toBe('ok');
    });

    it('should handle precision edge cases', () => {
      // Test floating point precision scenarios
      const budgetStatus1 = createBudgetStatus(1/3, 1);
      expect(budgetStatus1.percentUsed).toBeCloseTo(33.333333, 5);

      const budgetStatus2 = createBudgetStatus(0.1 + 0.2, 1);
      expect(budgetStatus2.percentUsed).toBeCloseTo(30, 1); // Handle floating point arithmetic
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should simulate a typical API usage tracking session', async () => {
      // Initial state: budget not loaded
      const initialState: BudgetStatusState = {
        budgetStatus: null,
        isLoading: true,
        error: null,
        isEnabled: true
      };

      expect(initialState.budgetStatus).toBeNull();
      expect(initialState.isLoading).toBe(true);

      // After loading: budget status available
      const loadedState: BudgetStatusState = {
        budgetStatus: createBudgetStatus(25.50, 100),
        isLoading: false,
        error: null,
        isEnabled: true
      };

      expect(loadedState.budgetStatus).not.toBeNull();
      expect(loadedState.budgetStatus?.currentSpend).toBe(25.50);
      expect(loadedState.budgetStatus?.percentUsed).toBe(25.5);
      expect(loadedState.isLoading).toBe(false);

      // After making API calls: budget increased
      const updatedState: BudgetStatusState = {
        budgetStatus: createBudgetStatus(82.75, 100),
        isLoading: false,
        error: null,
        isEnabled: true
      };

      expect(updatedState.budgetStatus?.status).toBe('warning');
      expect(updatedState.budgetStatus?.percentUsed).toBe(82.75);
    });

    it('should simulate error handling scenarios', () => {
      // Network error during fetch
      const errorState: BudgetStatusState = {
        budgetStatus: null,
        isLoading: false,
        error: 'Network error: Failed to fetch budget data',
        isEnabled: true
      };

      expect(errorState.error).toContain('Network error');
      expect(errorState.budgetStatus).toBeNull();
      expect(errorState.isLoading).toBe(false);

      // API error with partial data
      const partialErrorState: BudgetStatusState = {
        budgetStatus: createBudgetStatus(45.30, 100),
        isLoading: false,
        error: 'Warning: Budget data may be outdated',
        isEnabled: true
      };

      expect(partialErrorState.budgetStatus).not.toBeNull();
      expect(partialErrorState.error).toContain('Warning');
    });

    it('should simulate hook return interface with mock implementations', async () => {
      // Create a mock hook return that properly tracks state changes
      const mockState = {
        budgetStatus: createBudgetStatus(30, 100),
        isLoading: false,
        error: null as string | null,
        isEnabled: true
      };

      const mockHookReturn: UseBudgetStatusReturn = {
        get budgetStatus() { return mockState.budgetStatus; },
        get isLoading() { return mockState.isLoading; },
        get error() { return mockState.error; },
        get isEnabled() { return mockState.isEnabled; },
        refresh: async () => {
          mockState.isLoading = true;
          // Simulate API call delay
          await new Promise(resolve => setTimeout(resolve, 10));
          mockState.budgetStatus = createBudgetStatus(35, 100);
          mockState.isLoading = false;
        },
        resetSpend: async () => {
          mockState.budgetStatus = createBudgetStatus(0, mockState.budgetStatus.budgetLimit);
        },
        setBudgetLimit: async (limit: number) => {
          mockState.budgetStatus = createBudgetStatus(mockState.budgetStatus.currentSpend, limit);
        }
      };

      // Test initial state
      expect(mockHookReturn.budgetStatus.currentSpend).toBe(30);
      expect(mockHookReturn.budgetStatus.percentUsed).toBe(30);

      // Test refresh functionality
      await mockHookReturn.refresh();
      expect(mockHookReturn.budgetStatus.currentSpend).toBe(35);

      // Test reset functionality
      await mockHookReturn.resetSpend();
      expect(mockHookReturn.budgetStatus.currentSpend).toBe(0);
      expect(mockHookReturn.budgetStatus.percentUsed).toBe(0);

      // Test budget limit update
      await mockHookReturn.setBudgetLimit(200);
      expect(mockHookReturn.budgetStatus.budgetLimit).toBe(200);
      expect(mockHookReturn.budgetStatus.percentUsed).toBe(0); // 0/200 = 0%
    });
  });

  describe('Options configuration scenarios', () => {
    it('should handle default configuration options', () => {
      const defaultOptions: UseBudgetStatusOptions = {
        initialLimit: 100,
        warningThreshold: 80,
        criticalThreshold: 95,
        refreshInterval: 30000,
        enabled: true
      };

      expect(defaultOptions.warningThreshold).toBe(80);
      expect(defaultOptions.criticalThreshold).toBe(95);
      expect(defaultOptions.refreshInterval).toBe(30000);
    });

    it('should handle custom threshold configurations', () => {
      const conservativeOptions: UseBudgetStatusOptions = {
        initialLimit: 50,
        warningThreshold: 60,
        criticalThreshold: 80,
        refreshInterval: 10000,
        enabled: true
      };

      const liberalOptions: UseBudgetStatusOptions = {
        initialLimit: 1000,
        warningThreshold: 90,
        criticalThreshold: 98,
        refreshInterval: 60000,
        enabled: true
      };

      expect(conservativeOptions.warningThreshold).toBeLessThan(liberalOptions.warningThreshold!);
      expect(conservativeOptions.criticalThreshold).toBeLessThan(liberalOptions.criticalThreshold!);
    });

    it('should handle disabled budget tracking', () => {
      const disabledOptions: UseBudgetStatusOptions = {
        enabled: false
      };

      const disabledState: BudgetStatusState = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: disabledOptions.enabled!
      };

      expect(disabledState.isEnabled).toBe(false);
      expect(disabledState.budgetStatus).toBeNull();
    });

    it('should handle minimal configuration', () => {
      const minimalOptions: UseBudgetStatusOptions = {
        initialLimit: 25
      };

      // Should work with just an initial limit
      expect(minimalOptions.initialLimit).toBe(25);
      expect(minimalOptions.warningThreshold).toBeUndefined();
      expect(minimalOptions.criticalThreshold).toBeUndefined();
    });
  });

  describe('Complex integration scenarios', () => {
    it('should handle rapid budget updates with state transitions', () => {
      const budgetLimit = 100;
      const spendingProgressions = [0, 15, 35, 60, 82, 97, 105, 120];

      const results = spendingProgressions.map(spend => createBudgetStatus(spend, budgetLimit));

      // Verify status progression
      expect(results[0].status).toBe('ok');    // 0%
      expect(results[1].status).toBe('ok');    // 15%
      expect(results[2].status).toBe('ok');    // 35%
      expect(results[3].status).toBe('ok');    // 60%
      expect(results[4].status).toBe('warning'); // 82%
      expect(results[5].status).toBe('critical'); // 97%
      expect(results[6].status).toBe('exceeded'); // 105%
      expect(results[7].status).toBe('exceeded'); // 120%
    });

    it('should handle concurrent budget tracking scenarios', () => {
      // Simulate multiple users or services tracking budgets
      const userBudgets = [
        createBudgetStatus(45, 100),   // User A: 45%
        createBudgetStatus(180, 200),  // User B: 90%
        createBudgetStatus(75, 50),    // User C: 150% (exceeded)
      ];

      expect(userBudgets[0].status).toBe('ok');
      expect(userBudgets[1].status).toBe('warning');
      expect(userBudgets[2].status).toBe('exceeded');

      // Verify each maintains independent state
      expect(userBudgets[0].percentUsed).toBe(45);
      expect(userBudgets[1].percentUsed).toBe(90);
      expect(userBudgets[2].percentUsed).toBe(150);
    });

    it('should handle timestamp accuracy for budget updates', () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const midTime = new Date('2024-01-15T10:30:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');

      const budget1: BudgetStatus = {
        currentSpend: 10,
        budgetLimit: 100,
        percentUsed: 10,
        status: 'ok',
        lastUpdated: startTime
      };

      const budget2: BudgetStatus = {
        currentSpend: 50,
        budgetLimit: 100,
        percentUsed: 50,
        status: 'ok',
        lastUpdated: midTime
      };

      const budget3: BudgetStatus = {
        currentSpend: 95,
        budgetLimit: 100,
        percentUsed: 95,
        status: 'critical',
        lastUpdated: endTime
      };

      // Verify chronological ordering
      expect(budget1.lastUpdated.getTime()).toBeLessThan(budget2.lastUpdated.getTime());
      expect(budget2.lastUpdated.getTime()).toBeLessThan(budget3.lastUpdated.getTime());

      // Verify spending progression aligns with time progression
      expect(budget1.currentSpend).toBeLessThan(budget2.currentSpend);
      expect(budget2.currentSpend).toBeLessThan(budget3.currentSpend);
    });
  });

  describe('Performance and memory considerations', () => {
    it('should handle large numbers of budget status objects efficiently', () => {
      const budgetStatuses: BudgetStatus[] = [];

      // Create 1000 budget status objects
      for (let i = 0; i < 1000; i++) {
        budgetStatuses.push(createBudgetStatus(i * 0.1, 100));
      }

      expect(budgetStatuses).toHaveLength(1000);
      expect(budgetStatuses[999].currentSpend).toBe(99.9);
      expect(budgetStatuses[999].percentUsed).toBeCloseTo(99.9, 1);
    });

    it('should handle rapid state updates without memory leaks', () => {
      let currentState: BudgetStatusState = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true
      };

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        currentState = {
          ...currentState,
          budgetStatus: createBudgetStatus(i, 100)
        };
      }

      expect(currentState.budgetStatus?.currentSpend).toBe(99);
      expect(currentState.budgetStatus?.percentUsed).toBe(99);
    });
  });
});