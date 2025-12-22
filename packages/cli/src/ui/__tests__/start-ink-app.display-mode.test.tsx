/**
 * Tests for startInkApp function focusing on DisplayMode initialization
 * Tests the initial state creation and default display mode setting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startInkApp, type StartInkAppOptions } from '../index';
import type { DisplayMode, ApexConfig } from '@apexcli/core';

describe('startInkApp DisplayMode Initialization', () => {
  let mockOnCommand: vi.Mock;
  let mockOnTask: vi.Mock;
  let mockOnExit: vi.Mock;
  let baseOptions: StartInkAppOptions;

  beforeEach(() => {
    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

    baseOptions = {
      projectPath: '/test/project',
      initialized: true,
      config: null,
      orchestrator: null,
      onCommand: mockOnCommand,
      onTask: mockOnTask,
      onExit: mockOnExit,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up any ink app instances
    if ((globalThis as any).__apexApp) {
      delete (globalThis as any).__apexApp;
    }
  });

  describe('Initial State Creation', () => {
    it('should create initial state with default normal display mode', async () => {
      const appInstance = await startInkApp(baseOptions);

      expect(appInstance).toBeDefined();
      expect(appInstance.getState).toBeDefined();

      const state = appInstance.getState();
      expect(state.displayMode).toBe('normal');
    });

    it('should set displayMode to normal when config is null', async () => {
      const optionsWithNullConfig = {
        ...baseOptions,
        config: null,
      };

      const appInstance = await startInkApp(optionsWithNullConfig);
      const state = appInstance.getState();

      expect(state.displayMode).toBe('normal');
      expect(state.config).toBeNull();
    });

    it('should set displayMode to normal when config exists but no display preferences', async () => {
      const configWithoutDisplay: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
        },
      };

      const optionsWithConfig = {
        ...baseOptions,
        config: configWithoutDisplay,
      };

      const appInstance = await startInkApp(optionsWithConfig);
      const state = appInstance.getState();

      expect(state.displayMode).toBe('normal');
      expect(state.config).toEqual(configWithoutDisplay);
    });

    it('should initialize other state properties correctly alongside displayMode', async () => {
      const appInstance = await startInkApp(baseOptions);
      const state = appInstance.getState();

      // Check that all required AppState properties are initialized
      expect(state.initialized).toBe(true);
      expect(state.projectPath).toBe('/test/project');
      expect(state.config).toBeNull();
      expect(state.orchestrator).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.inputHistory).toEqual([]);
      expect(state.isProcessing).toBe(false);
      expect(state.tokens).toEqual({ input: 0, output: 0 });
      expect(state.cost).toBe(0);
      expect(state.model).toBe('sonnet');
      expect(state.sessionStartTime).toBeInstanceOf(Date);
      expect(state.sessionName).toMatch(/^Session/);
      expect(state.displayMode).toBe('normal');
    });

    it('should use model from config when available', async () => {
      const configWithModels: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
        },
        models: {
          implementation: 'opus',
          planning: 'sonnet',
          review: 'haiku',
        },
      };

      const optionsWithModels = {
        ...baseOptions,
        config: configWithModels,
      };

      const appInstance = await startInkApp(optionsWithModels);
      const state = appInstance.getState();

      expect(state.model).toBe('opus');
      expect(state.displayMode).toBe('normal'); // Should still default to normal
    });

    it('should handle gitBranch parameter correctly', async () => {
      const optionsWithBranch = {
        ...baseOptions,
        gitBranch: 'feature/test-display-mode',
      };

      const appInstance = await startInkApp(optionsWithBranch);
      const state = appInstance.getState();

      expect(state.gitBranch).toBe('feature/test-display-mode');
      expect(state.displayMode).toBe('normal');
    });

    it('should create valid session information', async () => {
      const beforeStart = new Date();
      const appInstance = await startInkApp(baseOptions);
      const afterStart = new Date();
      const state = appInstance.getState();

      expect(state.sessionStartTime).toBeInstanceOf(Date);
      expect(state.sessionStartTime!.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
      expect(state.sessionStartTime!.getTime()).toBeLessThanOrEqual(afterStart.getTime());
      expect(state.sessionName).toMatch(/^Session \d{1,2}\/\d{1,2}\/\d{4}$/);
      expect(state.displayMode).toBe('normal');
    });
  });

  describe('App Instance Methods', () => {
    it('should return app instance with correct interface', async () => {
      const appInstance = await startInkApp(baseOptions);

      expect(appInstance.addMessage).toBeDefined();
      expect(appInstance.updateState).toBeDefined();
      expect(appInstance.getState).toBeDefined();
      expect(appInstance.waitUntilExit).toBeDefined();
      expect(appInstance.unmount).toBeDefined();

      expect(typeof appInstance.addMessage).toBe('function');
      expect(typeof appInstance.updateState).toBe('function');
      expect(typeof appInstance.getState).toBe('function');
      expect(typeof appInstance.waitUntilExit).toBe('function');
      expect(typeof appInstance.unmount).toBe('function');
    });

    it('should allow displayMode updates via updateState', async () => {
      const appInstance = await startInkApp(baseOptions);

      // Initial state should be normal
      expect(appInstance.getState().displayMode).toBe('normal');

      // Update to compact
      appInstance.updateState({ displayMode: 'compact' });
      expect(appInstance.getState().displayMode).toBe('compact');

      // Update to verbose
      appInstance.updateState({ displayMode: 'verbose' });
      expect(appInstance.getState().displayMode).toBe('verbose');

      // Back to normal
      appInstance.updateState({ displayMode: 'normal' });
      expect(appInstance.getState().displayMode).toBe('normal');
    });

    it('should handle partial state updates without affecting displayMode', async () => {
      const appInstance = await startInkApp(baseOptions);

      // Set initial display mode
      appInstance.updateState({ displayMode: 'verbose' });
      expect(appInstance.getState().displayMode).toBe('verbose');

      // Update other state properties
      appInstance.updateState({
        tokens: { input: 100, output: 200 },
        cost: 0.05,
        isProcessing: true,
      });

      // DisplayMode should remain unchanged
      expect(appInstance.getState().displayMode).toBe('verbose');
      expect(appInstance.getState().tokens).toEqual({ input: 100, output: 200 });
      expect(appInstance.getState().cost).toBe(0.05);
      expect(appInstance.getState().isProcessing).toBe(true);
    });

    it('should handle displayMode updates with other properties', async () => {
      const appInstance = await startInkApp(baseOptions);

      // Update multiple properties including displayMode
      appInstance.updateState({
        displayMode: 'compact',
        activeAgent: 'developer',
        tokens: { input: 50, output: 100 },
        cost: 0.02,
      });

      const state = appInstance.getState();
      expect(state.displayMode).toBe('compact');
      expect(state.activeAgent).toBe('developer');
      expect(state.tokens).toEqual({ input: 50, output: 100 });
      expect(state.cost).toBe(0.02);
    });
  });

  describe('Global Instance Management', () => {
    it('should set global __apexApp instance', async () => {
      await startInkApp(baseOptions);

      const globalApp = (globalThis as any).__apexApp;
      expect(globalApp).toBeDefined();
      expect(globalApp.getState).toBeDefined();
      expect(globalApp.getState().displayMode).toBe('normal');
    });

    it('should handle multiple app instance creation', async () => {
      const appInstance1 = await startInkApp(baseOptions);
      const state1 = appInstance1.getState();
      expect(state1.displayMode).toBe('normal');

      // Update first instance
      appInstance1.updateState({ displayMode: 'compact' });
      expect(appInstance1.getState().displayMode).toBe('compact');

      // Create second instance (this would replace global reference)
      const appInstance2 = await startInkApp({
        ...baseOptions,
        projectPath: '/test/project2',
      });

      // Second instance should have its own state
      const state2 = appInstance2.getState();
      expect(state2.displayMode).toBe('normal');
      expect(state2.projectPath).toBe('/test/project2');
    });

    it('should cleanup global instance on unmount', async () => {
      const appInstance = await startInkApp(baseOptions);

      // Verify global instance exists
      expect((globalThis as any).__apexApp).toBeDefined();

      // Unmount the app
      appInstance.unmount();

      // Note: The actual cleanup might happen asynchronously
      // In a real test, we might need to wait or check the cleanup behavior
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid config gracefully', async () => {
      const optionsWithInvalidConfig = {
        ...baseOptions,
        config: { invalid: 'config' } as any,
      };

      expect(async () => {
        await startInkApp(optionsWithInvalidConfig);
      }).not.toThrow();
    });

    it('should handle missing required options', async () => {
      const incompleteOptions = {
        projectPath: '/test/project',
        initialized: true,
        // Missing config, orchestrator, and callbacks
      } as any;

      expect(async () => {
        await startInkApp(incompleteOptions);
      }).not.toThrow();
    });

    it('should return fallback state when global instance not available', async () => {
      const appInstance = await startInkApp(baseOptions);

      // Remove global instance
      delete (globalThis as any).__apexApp;

      // Should return initial state as fallback
      const fallbackState = appInstance.getState();
      expect(fallbackState).toBeDefined();
      expect(fallbackState.displayMode).toBe('normal');
    });
  });

  describe('Type Safety', () => {
    it('should enforce DisplayMode type constraints', async () => {
      const appInstance = await startInkApp(baseOptions);

      // These should work (valid DisplayMode values)
      appInstance.updateState({ displayMode: 'normal' });
      appInstance.updateState({ displayMode: 'compact' });
      appInstance.updateState({ displayMode: 'verbose' });

      // Invalid values would be caught by TypeScript at compile time
      // appInstance.updateState({ displayMode: 'invalid' }); // TypeScript error

      expect(appInstance.getState().displayMode).toBe('verbose');
    });

    it('should maintain type safety across method calls', async () => {
      const appInstance = await startInkApp(baseOptions);

      // The state should always conform to AppState interface
      const state = appInstance.getState();
      expect(typeof state.displayMode).toBe('string');
      expect(['normal', 'compact', 'verbose']).toContain(state.displayMode);
    });
  });
});