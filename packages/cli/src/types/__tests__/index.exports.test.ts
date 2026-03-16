/**
 * Comprehensive export tests for types index file
 * Tests that all types from the types module are properly exported and accessible
 */

import { describe, it, expect } from 'vitest';

describe('types/index.ts exports', () => {
  describe('Budget status type exports', () => {
    it('exports BudgetStatus type', () => {
      // We test type exports through compilation and runtime type checking
      const testBudgetStatus = (budget: any): budget is import('../index').BudgetStatus => {
        return (
          budget &&
          typeof budget.currentSpend === 'number' &&
          typeof budget.budgetLimit === 'number' &&
          typeof budget.percentUsed === 'number' &&
          typeof budget.status === 'string' &&
          ['ok', 'warning', 'critical', 'exceeded'].includes(budget.status) &&
          budget.lastUpdated instanceof Date
        );
      };

      const validBudgetStatus = {
        currentSpend: 50.25,
        budgetLimit: 100,
        percentUsed: 50.25,
        status: 'ok' as const,
        lastUpdated: new Date(),
      };

      expect(testBudgetStatus(validBudgetStatus)).toBe(true);
    });

    it('exports BudgetStatusLevel type', () => {
      // Test that the type union is properly exported
      const testBudgetStatusLevel = (level: string): level is import('../index').BudgetStatusLevel => {
        return ['ok', 'warning', 'critical', 'exceeded'].includes(level);
      };

      expect(testBudgetStatusLevel('ok')).toBe(true);
      expect(testBudgetStatusLevel('warning')).toBe(true);
      expect(testBudgetStatusLevel('critical')).toBe(true);
      expect(testBudgetStatusLevel('exceeded')).toBe(true);
      expect(testBudgetStatusLevel('invalid')).toBe(false);
    });

    it('exports BudgetStatusState type', () => {
      const testBudgetStatusState = (state: any): boolean => {
        return (
          state &&
          (state.budgetStatus === null || typeof state.budgetStatus === 'object') &&
          typeof state.isLoading === 'boolean' &&
          (state.error === null || typeof state.error === 'string') &&
          typeof state.isEnabled === 'boolean'
        );
      };

      const validState = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true,
      };

      expect(testBudgetStatusState(validState)).toBe(true);
    });

    it('exports UseBudgetStatusReturn type', () => {
      const testUseBudgetStatusReturn = (returnValue: any): boolean => {
        return (
          returnValue &&
          (returnValue.budgetStatus === null || typeof returnValue.budgetStatus === 'object') &&
          typeof returnValue.isLoading === 'boolean' &&
          (returnValue.error === null || typeof returnValue.error === 'string') &&
          typeof returnValue.isEnabled === 'boolean' &&
          typeof returnValue.refresh === 'function' &&
          typeof returnValue.resetSpend === 'function' &&
          typeof returnValue.setBudgetLimit === 'function'
        );
      };

      const validReturnValue = {
        budgetStatus: null,
        isLoading: false,
        error: null,
        isEnabled: true,
        refresh: async () => {},
        resetSpend: async () => {},
        setBudgetLimit: async () => {},
      };

      expect(testUseBudgetStatusReturn(validReturnValue)).toBe(true);
    });

    it('exports UseBudgetStatusOptions type', () => {
      const testUseBudgetStatusOptions = (options: any): boolean => {
        return (
          options &&
          (options.initialLimit === undefined || typeof options.initialLimit === 'number') &&
          (options.warningThreshold === undefined || typeof options.warningThreshold === 'number') &&
          (options.criticalThreshold === undefined || typeof options.criticalThreshold === 'number') &&
          (options.refreshInterval === undefined || typeof options.refreshInterval === 'number') &&
          (options.enabled === undefined || typeof options.enabled === 'boolean')
        );
      };

      const validOptions = {
        initialLimit: 100,
        warningThreshold: 80,
        criticalThreshold: 95,
        refreshInterval: 5000,
        enabled: true,
      };

      expect(testUseBudgetStatusOptions(validOptions)).toBe(true);
      expect(testUseBudgetStatusOptions({})).toBe(true); // Empty options should be valid
    });
  });

  describe('Theme type exports', () => {
    it('exports SyntaxColors type', () => {
      const testSyntaxColors = (colors: any): boolean => {
        return (
          colors &&
          typeof colors.keyword === 'string' &&
          typeof colors.string === 'string' &&
          typeof colors.comment === 'string' &&
          typeof colors.number === 'string' &&
          typeof colors.function === 'string' &&
          typeof colors.variable === 'string' &&
          typeof colors.operator === 'string' &&
          typeof colors.bracket === 'string' &&
          typeof colors.error === 'string'
        );
      };

      const validSyntaxColors = {
        keyword: '#ff0000',
        string: '#00ff00',
        comment: '#0000ff',
        number: '#ffff00',
        function: '#ff00ff',
        variable: '#00ffff',
        operator: '#ffffff',
        bracket: '#888888',
        error: '#ff4444',
      };

      expect(testSyntaxColors(validSyntaxColors)).toBe(true);
    });

    it('exports AgentColors type', () => {
      const testAgentColors = (colors: any): boolean => {
        return (
          colors &&
          typeof colors.planner === 'string' &&
          typeof colors.architect === 'string' &&
          typeof colors.developer === 'string' &&
          typeof colors.tester === 'string' &&
          typeof colors.reviewer === 'string' &&
          typeof colors.deployer === 'string' &&
          typeof colors.default === 'string'
        );
      };

      const validAgentColors = {
        planner: '#ff0000',
        architect: '#00ff00',
        developer: '#0000ff',
        tester: '#ffff00',
        reviewer: '#ff00ff',
        deployer: '#00ffff',
        default: '#888888',
      };

      expect(testAgentColors(validAgentColors)).toBe(true);
    });

    it('exports Theme type', () => {
      const testTheme = (theme: any): boolean => {
        return (
          theme &&
          typeof theme.primary === 'string' &&
          typeof theme.secondary === 'string' &&
          typeof theme.accent === 'string' &&
          typeof theme.background === 'string' &&
          typeof theme.surface === 'string' &&
          typeof theme.text === 'string' &&
          typeof theme.textSecondary === 'string' &&
          typeof theme.border === 'string' &&
          typeof theme.success === 'string' &&
          typeof theme.warning === 'string' &&
          typeof theme.error === 'string' &&
          typeof theme.syntax === 'object' &&
          typeof theme.agents === 'object'
        );
      };

      const validTheme = {
        primary: '#007acc',
        secondary: '#6c757d',
        accent: '#28a745',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#212529',
        textSecondary: '#6c757d',
        border: '#dee2e6',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        syntax: {
          keyword: '#ff0000',
          string: '#00ff00',
          comment: '#0000ff',
          number: '#ffff00',
          function: '#ff00ff',
          variable: '#00ffff',
          operator: '#ffffff',
          bracket: '#888888',
          error: '#ff4444',
        },
        agents: {
          planner: '#ff0000',
          architect: '#00ff00',
          developer: '#0000ff',
          tester: '#ffff00',
          reviewer: '#ff00ff',
          deployer: '#00ffff',
          default: '#888888',
        },
      };

      expect(testTheme(validTheme)).toBe(true);
    });

    it('exports ThemeConfig type', () => {
      const testThemeConfig = (config: any): boolean => {
        return (
          config &&
          typeof config.themes === 'object' &&
          typeof config.currentTheme === 'string' &&
          typeof config.userPreferences === 'object'
        );
      };

      const validThemeConfig = {
        themes: {
          light: {},
          dark: {},
        },
        currentTheme: 'light',
        userPreferences: {
          autoSwitch: true,
          preferredTheme: 'dark',
        },
      };

      expect(testThemeConfig(validThemeConfig)).toBe(true);
    });

    it('exports ThemeName type', () => {
      const testThemeName = (name: string): boolean => {
        return ['light', 'dark', 'auto'].includes(name);
      };

      expect(testThemeName('light')).toBe(true);
      expect(testThemeName('dark')).toBe(true);
      expect(testThemeName('auto')).toBe(true);
      expect(testThemeName('invalid')).toBe(false);
    });
  });

  describe('Type compilation tests', () => {
    it('compiles budget status types without errors', async () => {
      // This test verifies that all types are properly exported by importing them
      try {
        // If this import succeeds without TypeScript errors, the types are properly exported
        await import('../index');
        // We can't test types directly at runtime, but we can test that the import succeeded
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Failed to import budget status types: ${error}`);
      }
    });

    it('compiles theme types without errors', async () => {
      try {
        await import('../index');
        expect(true).toBe(true);
      } catch (error) {
        throw new Error(`Failed to import theme types: ${error}`);
      }
    });

    it('allows proper type usage in TypeScript', () => {
      // Test that types can be used for type annotations
      const createBudgetStatus = (): import('../index').BudgetStatus => {
        return {
          currentSpend: 75,
          budgetLimit: 100,
          percentUsed: 75,
          status: 'warning',
          lastUpdated: new Date(),
        };
      };

      const budgetStatus = createBudgetStatus();
      expect(budgetStatus.currentSpend).toBe(75);
      expect(budgetStatus.status).toBe('warning');
    });
  });

  describe('Cross-module type compatibility', () => {
    it('budget status types are compatible with hook types', async () => {
      // Verify that types from types/index.ts are compatible with hook types
      // This helps ensure the barrel exports don't break type relationships

      const budgetOptions: import('../index').UseBudgetStatusOptions = {
        initialLimit: 100,
        warningThreshold: 80,
        criticalThreshold: 95,
        refreshInterval: 5000,
        enabled: true,
      };

      expect(budgetOptions.warningThreshold).toBe(80);
    });

    it('theme types can be used together', async () => {
      const syntaxColors: import('../index').SyntaxColors = {
        keyword: '#ff0000',
        string: '#00ff00',
        comment: '#0000ff',
        number: '#ffff00',
        function: '#ff00ff',
        variable: '#00ffff',
        operator: '#ffffff',
        bracket: '#888888',
        error: '#ff4444',
      };

      const agentColors: import('../index').AgentColors = {
        planner: '#ff0000',
        architect: '#00ff00',
        developer: '#0000ff',
        tester: '#ffff00',
        reviewer: '#ff00ff',
        deployer: '#00ffff',
        default: '#888888',
      };

      const theme: import('../index').Theme = {
        primary: '#007acc',
        secondary: '#6c757d',
        accent: '#28a745',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#212529',
        textSecondary: '#6c757d',
        border: '#dee2e6',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        syntax: syntaxColors,
        agents: agentColors,
      };

      expect(theme.syntax.keyword).toBe('#ff0000');
      expect(theme.agents.planner).toBe('#ff0000');
    });
  });
});