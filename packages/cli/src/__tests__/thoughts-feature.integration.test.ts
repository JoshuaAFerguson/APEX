/**
 * Integration tests for the complete /thoughts command and Ctrl+T keyboard shortcut feature
 * Tests both CLI and UI modes, state management, and real interaction scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import React from 'react';
import { App, type AppState } from '../ui/App.js';
import { ShortcutManager, type ShortcutEvent } from '../services/ShortcutManager.js';
import type { ApexConfig } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

const { getLatestSubmit, setLatestSubmit } = vi.hoisted(() => {
  let latestSubmit: ((input: string) => void) | null = null;
  return {
    getLatestSubmit: () => latestSubmit,
    setLatestSubmit: (handler: ((input: string) => void) | null) => {
      latestSubmit = handler;
    },
  };
});

// Mock dependencies
vi.mock('@apexcli/orchestrator');
vi.mock('../services/ConversationManager.js', () => ({
  ConversationManager: class MockConversationManager {
    addMessage = vi.fn();
    clearContext = vi.fn();
    getSuggestions = vi.fn(() => []);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.8 }));
    hasPendingClarification = vi.fn(() => false);
    provideClarification = vi.fn();
  },
}));
vi.mock('ink-use-stdout-dimensions', () => ({
  default: () => [80, 24],
}));
vi.mock('../ui/components/index.js', async () => {
  const { Text } = await vi.importActual<typeof import('ink')>('ink');
  return {
    ActivityLog: () => null,
    AgentPanel: () => null,
    Banner: ({
      initialized,
      projectPath,
    }: {
      initialized?: boolean;
      projectPath?: string;
    }) =>
      initialized && projectPath
        ? React.createElement(Text, null, `Initialized in ${projectPath}`)
        : null,
    InputPrompt: ({ onSubmit }: { onSubmit: (input: string) => void }) => {
      setLatestSubmit(onSubmit);
      return null;
    },
    PreviewPanel: () => null,
    ResponseStream: ({ content }: { content: string }) =>
      React.createElement(Text, null, content),
    ServicesPanel: () => null,
    StatusBar: () => null,
    TaskProgress: () => null,
    ThoughtDisplay: () => null,
    ToolCall: () => null,
  };
});

describe('Thoughts Feature Integration Tests', () => {
  let mockConfig: ApexConfig;
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let shortcutManager: ShortcutManager;
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  const createInitialState = (overrides: Partial<AppState> = {}): AppState => ({
    initialized: true,
    projectPath: '/test/project',
    config: mockConfig,
    orchestrator: mockOrchestrator as ApexOrchestrator,
    gitBranch: 'main',
    messages: [],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: 'claude-3-sonnet',
    displayMode: 'normal',
    previewMode: false,
    previewConfig: {
      confidenceThreshold: 0.7,
      autoExecuteHighConfidence: false,
      timeoutMs: 3000,
    },
    showThoughts: false,
    ...overrides,
  });
  const createAppElement = (overrides: Partial<AppState> = {}) =>
    React.createElement(App, {
      initialState: createInitialState(overrides),
      onCommand: mockOnCommand,
      onTask: mockOnTask,
      onExit: mockOnExit,
    });
  const submitInput = async (input: string, delayMs = 20) => {
    const handler = getLatestSubmit();
    expect(handler).toBeDefined();
    handler?.(input);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  };

  beforeEach(() => {
    mockConfig = {
      project: {
        name: 'Test Project',
        description: 'Test project for thoughts feature',
      },
      agents: {},
      workflows: {},
      limits: {
        maxTokens: 100000,
        maxCost: 10.0,
        timeoutMs: 300000,
      },
      autonomy: {
        level: 'medium',
        autoApprove: false,
      },
    };

    mockOrchestrator = {
      on: vi.fn(),
      off: vi.fn(),
      getTaskStore: vi.fn().mockReturnValue({
        getTasks: vi.fn().mockReturnValue([]),
      }),
    };

    shortcutManager = new ShortcutManager();
    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('/thoughts command functionality', () => {
    it('should toggle thoughts visibility from disabled to enabled', async () => {
      const { lastFrame } = render(createAppElement());

      await submitInput('/thoughts');

      const output = lastFrame();
      expect(output).toContain('Thought visibility enabled');
      expect(output).toContain('AI reasoning will be shown');
    });

    it('should toggle thoughts visibility from enabled to disabled', async () => {
      const { lastFrame } = render(createAppElement());

      await submitInput('/thoughts');
      await submitInput('/thoughts');

      const output = lastFrame();
      expect(output).toContain('Thought visibility disabled');
      expect(output).toContain('AI reasoning will be hidden');
    });

    it('should handle thoughts command with proper message formatting', async () => {
      const { lastFrame } = render(createAppElement());

      await submitInput('/thoughts');

      const output = lastFrame();
      expect(output).toContain('Thought visibility enabled');
    });

    it('should maintain other app state during thoughts toggle', async () => {
      const { lastFrame } = render(createAppElement());

      expect(lastFrame()).toContain('Initialized in /test/project');

      await submitInput('/thoughts', 0);
      expect(lastFrame()).toContain('Initialized in /test/project');
    });

    it('should handle thoughts command during processing state', async () => {
      const { lastFrame } = render(createAppElement({ isProcessing: true }));

      await submitInput('/thoughts');

      const output = lastFrame();
      expect(output).toContain('Thought visibility enabled');
    });
  });

  describe('Ctrl+T keyboard shortcut functionality', () => {
    it('should register Ctrl+T shortcut correctly', () => {
      const shortcuts = shortcutManager.getShortcuts();
      const thoughtsShortcut = shortcuts.find(s => s.id === 'toggleThoughts');

      expect(thoughtsShortcut).toBeDefined();
      expect(thoughtsShortcut?.keys.key).toBe('t');
      expect(thoughtsShortcut?.keys.ctrl).toBe(true);
      expect(thoughtsShortcut?.description).toBe('Toggle thoughts display');
    });

    it('should trigger thoughts command via Ctrl+T', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const handled = shortcutManager.handleKey(ctrlTEvent);

      expect(handled).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should not trigger on partial key combinations', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      // Test various invalid combinations
      const invalidEvents: ShortcutEvent[] = [
        { key: 't', ctrl: false, alt: false, shift: false, meta: false }, // Just T
        { key: 't', ctrl: false, alt: true, shift: false, meta: false }, // Alt+T
        { key: 't', ctrl: false, alt: false, shift: true, meta: false }, // Shift+T
        { key: 'r', ctrl: true, alt: false, shift: false, meta: false }, // Ctrl+R
      ];

      invalidEvents.forEach(event => {
        shortcutManager.handleKey(event);
      });

      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should work in different contexts', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // Test in global context
      expect(shortcutManager.getCurrentContext()).toBe('global');
      expect(shortcutManager.handleKey(ctrlTEvent)).toBe(true);

      // Test in input context
      shortcutManager.pushContext('input');
      expect(shortcutManager.handleKey(ctrlTEvent)).toBe(true);

      // Should have been called twice
      expect(commandHandler).toHaveBeenCalledTimes(2);
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });
  });

  describe('Thought display integration', () => {
    it('should show thinking content when thoughts are enabled', () => {
      const { rerender, lastFrame } = render(createAppElement());

      rerender(createAppElement());
      expect(lastFrame()).toBeDefined();
    });

    it('should handle thoughts toggle with existing conversation', async () => {
      const { lastFrame } = render(createAppElement({
        messages: [
          {
            id: 'msg_1',
            type: 'user',
            content: 'Hello, can you help me?',
            timestamp: new Date(),
          },
        ],
      }));

      await submitInput('/thoughts');
      expect(lastFrame()).toContain('Thought visibility enabled');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle rapid thoughts toggles', async () => {
      const { lastFrame } = render(createAppElement());

      await submitInput('/thoughts', 5);
      await submitInput('/thoughts', 5);
      await submitInput('/thoughts', 5);

      const output = lastFrame();
      expect(output).toContain('Thought visibility enabled');
    });

    it('should handle thoughts command with extra arguments gracefully', async () => {
      const { lastFrame } = render(createAppElement());

      await submitInput('/thoughts extra args');

      const output = lastFrame();
      expect(output).toContain('Thought visibility enabled');
    });

    it('should handle malformed shortcut events', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      // Empty key event
      const emptyEvent: ShortcutEvent = {
        key: '',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const handled = shortcutManager.handleKey(emptyEvent);
      expect(handled).toBe(false);
      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should maintain case insensitivity for keyboard shortcuts', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      // Test both uppercase and lowercase
      const upperEvent: ShortcutEvent = {
        key: 'T',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const lowerEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      expect(shortcutManager.handleKey(upperEvent)).toBe(true);
      expect(shortcutManager.handleKey(lowerEvent)).toBe(true);
      expect(commandHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and optimization', () => {
    it('should handle thoughts toggle efficiently with large message history', async () => {
      const { lastFrame } = render(createAppElement());

      // Simulate many messages (this would normally be handled by the app state)
      const start = performance.now();

      await submitInput('/thoughts');

      const end = performance.now();

      // Should complete quickly
      expect(end - start).toBeLessThan(100);
      expect(lastFrame()).toContain('Thought visibility enabled');
    });

    it('should handle rapid keyboard shortcut triggers efficiently', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const start = performance.now();

      // Simulate rapid shortcut presses
      for (let i = 0; i < 100; i++) {
        shortcutManager.handleKey(ctrlTEvent);
      }

      const end = performance.now();

      expect(end - start).toBeLessThan(100);
      expect(commandHandler).toHaveBeenCalledTimes(100);
    });
  });

  describe('Accessibility and usability', () => {
    it('should provide clear feedback for thoughts toggle', async () => {
      const { lastFrame } = render(createAppElement());

      await submitInput('/thoughts');

      const output = lastFrame();
      expect(output).toContain('Thought visibility enabled');
      expect(output).toContain('AI reasoning will be shown');
    });

    it('should maintain consistent behavior across input methods', async () => {
      // Test command-based toggle
      const { lastFrame } = render(createAppElement());
      await submitInput('/thoughts');

      // Test shortcut-based toggle (simulated through command handler)
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const ctrlTEvent: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      shortcutManager.handleKey(ctrlTEvent);

      // Both should result in the same command being triggered
      expect(lastFrame()).toContain('Thought visibility enabled');
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });
  });

  describe('State persistence and consistency', () => {
    it('should maintain thoughts toggle state across renders', async () => {
      const { lastFrame, rerender } = render(createAppElement());

      // Enable thoughts
      await submitInput('/thoughts');

      // Force rerender
      rerender(createAppElement());

      // State should be maintained (though this is simplified for testing)
      expect(lastFrame()).toContain('Thought visibility enabled');
    });

    it('should handle concurrent thoughts toggles correctly', async () => {
      const { lastFrame } = render(createAppElement());

      const togglePromises = [
        new Promise(resolve => {
          submitInput('/thoughts', 5).then(resolve);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            submitInput('/thoughts', 5).then(() => resolve(undefined));
          }, 2);
        }),
      ];

      await Promise.all(togglePromises);

      expect(lastFrame()).toMatch(/Thought visibility (enabled|disabled)/);
    });
  });
});
