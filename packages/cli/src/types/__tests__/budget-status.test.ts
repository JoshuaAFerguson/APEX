/**
 * Comprehensive tests for BudgetStatus types
 * Tests TypeScript compilation, type safety, and interface contracts
 */

import { describe, it, expect } from 'vitest';
import type {
  BudgetStatus,
  BudgetStatusLevel,
  BudgetStatusState,
  UseBudgetStatusReturn,
  UseBudgetStatusOptions
} from '../budget-status';

describe('BudgetStatus Types', () => {
  describe('BudgetStatusLevel type', () => {
    it('should accept valid status levels', () => {
      const okStatus: BudgetStatusLevel = 'ok';
      const warningStatus: BudgetStatusLevel = 'warning';
      const criticalStatus: BudgetStatusLevel = 'critical';
      const exceededStatus: BudgetStatusLevel = 'exceeded';

      expect(okStatus).toBe('ok');
      expect(warningStatus).toBe('warning');
      expect(criticalStatus).toBe('critical');
      expect(exceededStatus).toBe('exceeded');
    });

    it('should have string literal types', () => {
      const status: BudgetStatusLevel = 'ok';
      expect(typeof status).toBe('string');
    });
  });

  describe('BudgetStatus interface', () => {
    it('should compile with all required fields', () => {
      const budgetStatus: BudgetStatus = {
        currentSpend: 150.50,
        budgetLimit: 500.00,
        percentUsed: 30.1,
        status: 'ok',
        lastUpdated: new Date('2024-01-15T10:30:00Z')
      };

      expect(budgetStatus.currentSpend).toBe(150.50);
      expect(budgetStatus.budgetLimit).toBe(500.00);
      expect(budgetStatus.percentUsed).toBe(30.1);
      expect(budgetStatus.status).toBe('ok');
      expect(budgetStatus.lastUpdated).toBeInstanceOf(Date);
    });

    it('should enforce number types for financial fields', () => {
      const budgetStatus: BudgetStatus = {
        currentSpend: 0,
        budgetLimit: 100,
        percentUsed: 0,
        status: 'ok',
        lastUpdated: new Date()
      };

      expect(typeof budgetStatus.currentSpend).toBe('number');
      expect(typeof budgetStatus.budgetLimit).toBe('number');
      expect(typeof budgetStatus.percentUsed).toBe('number');
    });

    it('should allow percentage over 100 when budget is exceeded', () => {
      const exceededBudget: BudgetStatus = {
        currentSpend: 1250.75,
        budgetLimit: 1000.00,
        percentUsed: 125.075,
        status: 'exceeded',
        lastUpdated: new Date()
      };

      expect(exceededBudget.percentUsed).toBeGreaterThan(100);
      expect(exceededBudget.status).toBe('exceeded');
    });

    it('should accept valid status levels', () => {
      const statuses: BudgetStatusLevel[] = ['ok', 'warning', 'critical', 'exceeded'];

      statuses.forEach(status => {
        const budgetStatus: BudgetStatus = {
          currentSpend: 100,
          budgetLimit: 500,
          percentUsed: 20,
          status,
          lastUpdated: new Date()
        };

        expect(budgetStatus.status).toBe(status);
      });
    });
  });

  describe('BudgetStatusState interface', () => {
    it('should compile with null budget status when not loaded', () => {
      const state: BudgetStatusState = {
        budgetStatus: null,
        isLoading: true,
        error: null,
        isEnabled: true
      };

      expect(state.budgetStatus).toBeNull();
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.isEnabled).toBe(true);
    });

    it('should compile with loaded budget status', () => {
      const budgetStatus: BudgetStatus = {
        currentSpend: 75.25,
        budgetLimit: 200.00,
        percentUsed: 37.625,
        status: 'ok',
        lastUpdated: new Date()
      };

      const state: BudgetStatusState = {
        budgetStatus,
        isLoading: false,
        error: null,
        isEnabled: true
      };

      expect(state.budgetStatus).not.toBeNull();
      expect(state.budgetStatus?.currentSpend).toBe(75.25);
      expect(state.isLoading).toBe(false);
    });

    it('should handle error states', () => {
      const errorState: BudgetStatusState = {
        budgetStatus: null,
        isLoading: false,
        error: 'Failed to fetch budget data',
        isEnabled: true
      };

      expect(errorState.error).toBe('Failed to fetch budget data');
      expect(errorState.budgetStatus).toBeNull();
    });

    it('should handle disabled state', () => {
      const disabledState: BudgetStatusState = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: false
      };

      expect(disabledState.isEnabled).toBe(false);
    });
  });

  describe('UseBudgetStatusReturn interface', () => {
    it('should extend BudgetStatusState with hook methods', () => {
      const mockRefresh = async (): Promise<void> => {};
      const mockResetSpend = async (): Promise<void> => {};
      const mockSetBudgetLimit = async (limit: number): Promise<void> => {};

      const hookReturn: UseBudgetStatusReturn = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true,
        refresh: mockRefresh,
        resetSpend: mockResetSpend,
        setBudgetLimit: mockSetBudgetLimit
      };

      expect(typeof hookReturn.refresh).toBe('function');
      expect(typeof hookReturn.resetSpend).toBe('function');
      expect(typeof hookReturn.setBudgetLimit).toBe('function');
    });

    it('should have async method signatures', () => {
      const mockMethods = {
        refresh: async (): Promise<void> => {},
        resetSpend: async (): Promise<void> => {},
        setBudgetLimit: async (limit: number): Promise<void> => {}
      };

      const hookReturn: UseBudgetStatusReturn = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true,
        ...mockMethods
      };

      expect(hookReturn.refresh()).toBeInstanceOf(Promise);
      expect(hookReturn.resetSpend()).toBeInstanceOf(Promise);
      expect(hookReturn.setBudgetLimit(100)).toBeInstanceOf(Promise);
    });

    it('should enforce parameter types for setBudgetLimit', () => {
      const hookReturn: UseBudgetStatusReturn = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true,
        refresh: async () => {},
        resetSpend: async () => {},
        setBudgetLimit: async (limit: number) => {
          expect(typeof limit).toBe('number');
        }
      };

      // Test that the method accepts numbers
      hookReturn.setBudgetLimit(250.50);
    });
  });

  describe('UseBudgetStatusOptions interface', () => {
    it('should compile with all optional fields', () => {
      const fullOptions: UseBudgetStatusOptions = {
        initialLimit: 1000,
        warningThreshold: 80,
        criticalThreshold: 95,
        refreshInterval: 30000,
        enabled: true
      };

      expect(fullOptions.initialLimit).toBe(1000);
      expect(fullOptions.warningThreshold).toBe(80);
      expect(fullOptions.criticalThreshold).toBe(95);
      expect(fullOptions.refreshInterval).toBe(30000);
      expect(fullOptions.enabled).toBe(true);
    });

    it('should compile with partial options', () => {
      const minimalOptions: UseBudgetStatusOptions = {
        initialLimit: 500
      };

      const partialOptions: UseBudgetStatusOptions = {
        warningThreshold: 75,
        criticalThreshold: 90
      };

      expect(minimalOptions.initialLimit).toBe(500);
      expect(minimalOptions.warningThreshold).toBeUndefined();

      expect(partialOptions.warningThreshold).toBe(75);
      expect(partialOptions.initialLimit).toBeUndefined();
    });

    it('should compile with empty options object', () => {
      const emptyOptions: UseBudgetStatusOptions = {};
      expect(Object.keys(emptyOptions)).toHaveLength(0);
    });

    it('should enforce number types for thresholds and limits', () => {
      const options: UseBudgetStatusOptions = {
        initialLimit: 750.25,
        warningThreshold: 82.5,
        criticalThreshold: 97.8,
        refreshInterval: 45000
      };

      expect(typeof options.initialLimit).toBe('number');
      expect(typeof options.warningThreshold).toBe('number');
      expect(typeof options.criticalThreshold).toBe('number');
      expect(typeof options.refreshInterval).toBe('number');
    });

    it('should enforce boolean type for enabled flag', () => {
      const enabledOptions: UseBudgetStatusOptions = {
        enabled: true
      };

      const disabledOptions: UseBudgetStatusOptions = {
        enabled: false
      };

      expect(typeof enabledOptions.enabled).toBe('boolean');
      expect(typeof disabledOptions.enabled).toBe('boolean');
      expect(enabledOptions.enabled).toBe(true);
      expect(disabledOptions.enabled).toBe(false);
    });
  });

  describe('Type compatibility and edge cases', () => {
    it('should handle zero values correctly', () => {
      const zeroBudget: BudgetStatus = {
        currentSpend: 0,
        budgetLimit: 0,
        percentUsed: 0,
        status: 'ok',
        lastUpdated: new Date()
      };

      expect(zeroBudget.currentSpend).toBe(0);
      expect(zeroBudget.budgetLimit).toBe(0);
      expect(zeroBudget.percentUsed).toBe(0);
    });

    it('should handle negative values (edge case)', () => {
      // While typically not expected, types should allow negative numbers
      const negativeBudget: BudgetStatus = {
        currentSpend: -10,
        budgetLimit: 100,
        percentUsed: -10,
        status: 'ok',
        lastUpdated: new Date()
      };

      expect(negativeBudget.currentSpend).toBe(-10);
      expect(negativeBudget.percentUsed).toBe(-10);
    });

    it('should handle very large numbers', () => {
      const largeBudget: BudgetStatus = {
        currentSpend: 999999.99,
        budgetLimit: 1000000,
        percentUsed: 99.999999,
        status: 'critical',
        lastUpdated: new Date()
      };

      expect(largeBudget.currentSpend).toBe(999999.99);
      expect(largeBudget.budgetLimit).toBe(1000000);
    });

    it('should handle fractional cents', () => {
      const preciseAmount: BudgetStatus = {
        currentSpend: 123.456789,
        budgetLimit: 500.123456,
        percentUsed: 24.691358,
        status: 'ok',
        lastUpdated: new Date()
      };

      expect(preciseAmount.currentSpend).toBe(123.456789);
      expect(preciseAmount.budgetLimit).toBe(500.123456);
    });

    it('should work with different Date formats', () => {
      const now = new Date();
      const isoDate = new Date('2024-01-15T10:30:00.000Z');
      const timestamp = new Date(1705312200000);

      const budgetStatus1: BudgetStatus = {
        currentSpend: 100,
        budgetLimit: 500,
        percentUsed: 20,
        status: 'ok',
        lastUpdated: now
      };

      const budgetStatus2: BudgetStatus = {
        currentSpend: 100,
        budgetLimit: 500,
        percentUsed: 20,
        status: 'ok',
        lastUpdated: isoDate
      };

      const budgetStatus3: BudgetStatus = {
        currentSpend: 100,
        budgetLimit: 500,
        percentUsed: 20,
        status: 'ok',
        lastUpdated: timestamp
      };

      expect(budgetStatus1.lastUpdated).toBeInstanceOf(Date);
      expect(budgetStatus2.lastUpdated).toBeInstanceOf(Date);
      expect(budgetStatus3.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Interface inheritance validation', () => {
    it('should verify UseBudgetStatusReturn extends BudgetStatusState', () => {
      // Create a BudgetStatusState
      const state: BudgetStatusState = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true
      };

      // UseBudgetStatusReturn should be assignable from BudgetStatusState + methods
      const hookReturn: UseBudgetStatusReturn = {
        ...state,
        refresh: async () => {},
        resetSpend: async () => {},
        setBudgetLimit: async () => {}
      };

      // Test that all base properties are preserved
      expect(hookReturn.budgetStatus).toBe(state.budgetStatus);
      expect(hookReturn.isLoading).toBe(state.isLoading);
      expect(hookReturn.error).toBe(state.error);
      expect(hookReturn.isEnabled).toBe(state.isEnabled);
    });

    it('should ensure method signatures are correct', () => {
      const hookReturn: UseBudgetStatusReturn = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true,
        refresh: async (): Promise<void> => {},
        resetSpend: async (): Promise<void> => {},
        setBudgetLimit: async (limit: number): Promise<void> => {}
      };

      // Verify return types
      const refreshPromise = hookReturn.refresh();
      const resetPromise = hookReturn.resetSpend();
      const setLimitPromise = hookReturn.setBudgetLimit(100);

      expect(refreshPromise).toBeInstanceOf(Promise);
      expect(resetPromise).toBeInstanceOf(Promise);
      expect(setLimitPromise).toBeInstanceOf(Promise);
    });
  });
});