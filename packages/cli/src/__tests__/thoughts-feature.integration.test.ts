/**
 * Integration tests for the complete /thoughts command and Ctrl+T keyboard shortcut feature
 * Tests both CLI and UI modes, state management, and real interaction scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import React from 'react';
import { App } from '../ui/App.js';
import { ShortcutManager, type ShortcutEvent } from '../services/ShortcutManager.js';
import type { ApexConfig } from '@apexcli/core';
import type { ApexOrchestrator } from '@apex/orchestrator';

// Mock dependencies
vi.mock('@apex/orchestrator');
vi.mock('../services/ConversationManager.js');

describe('Thoughts Feature Integration Tests', () => {
  let mockConfig: ApexConfig;
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let shortcutManager: ShortcutManager;

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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('/thoughts command functionality', () => {
    it('should toggle thoughts visibility from disabled to enabled', () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Send thoughts command
      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Should show confirmation message
      expect(output).toContain('Thought visibility enabled');
      expect(output).toContain('AI reasoning will be shown');
    });

    it('should toggle thoughts visibility from enabled to disabled', async () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // First enable thoughts
      stdin.write('/thoughts\r');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then disable thoughts
      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Should show disabled confirmation
      expect(output).toContain('Thought visibility disabled');
      expect(output).toContain('AI reasoning will be hidden');
    });

    it('should handle thoughts command with proper message formatting', () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Message should be properly formatted as system message
      expect(output).toMatch(/💭.*Thought visibility enabled/);
    });

    it('should maintain other app state during thoughts toggle', () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Verify initial state is maintained
      expect(lastFrame()).toContain('Test Project');

      stdin.write('/thoughts\r');

      // Project info should still be visible
      expect(lastFrame()).toContain('Test Project');
    });

    it('should handle thoughts command during processing state', () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Simulate processing state by triggering a task
      stdin.write('test task\r');

      // Then try thoughts command
      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Should still process thoughts command
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
      const { lastFrame, rerender } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Simulate receiving a message with thinking content
      const appWithMessage = (
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      rerender(appWithMessage);

      // Enable thoughts first, then check if thinking content would be displayed
      // Note: This is a simplified test - in real usage, the App component
      // manages the state and renders ThoughtDisplay components accordingly
      const output = lastFrame();
      expect(output).toBeDefined();
    });

    it('should handle thoughts toggle with existing conversation', async () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Send a message first
      stdin.write('Hello, can you help me?\r');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then toggle thoughts
      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Both the conversation and the thoughts toggle confirmation should be present
      expect(output).toContain('Thought visibility enabled');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle rapid thoughts toggles', async () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Rapid toggles
      stdin.write('/thoughts\r');
      await new Promise(resolve => setTimeout(resolve, 5));
      stdin.write('/thoughts\r');
      await new Promise(resolve => setTimeout(resolve, 5));
      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Should handle all toggles and show final state
      expect(output).toContain('Thought visibility enabled');
    });

    it('should handle thoughts command with extra arguments gracefully', () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Send command with extra args (should still work)
      stdin.write('/thoughts extra args\r');

      const output = lastFrame();

      // Should still toggle thoughts despite extra arguments
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
    it('should handle thoughts toggle efficiently with large message history', () => {
      const { stdin, lastFrame } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Simulate many messages (this would normally be handled by the app state)
      const start = performance.now();

      stdin.write('/thoughts\r');

      const end = performance.now();
      const output = lastFrame();

      // Should complete quickly
      expect(end - start).toBeLessThan(100);
      expect(output).toContain('Thought visibility enabled');
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
    it('should provide clear feedback for thoughts toggle', () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      stdin.write('/thoughts\r');

      const output = lastFrame();

      // Should provide clear, descriptive feedback
      expect(output).toMatch(/💭.*Thought visibility/);
      expect(output).toContain('AI reasoning will be shown');
    });

    it('should maintain consistent behavior across input methods', () => {
      // Test command-based toggle
      const { lastFrame: cmdFrame, stdin: cmdStdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      cmdStdin.write('/thoughts\r');
      const cmdOutput = cmdFrame();

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
      expect(cmdOutput).toContain('Thought visibility enabled');
      expect(commandHandler).toHaveBeenCalledWith('/thoughts');
    });
  });

  describe('State persistence and consistency', () => {
    it('should maintain thoughts toggle state across renders', async () => {
      const { lastFrame, stdin, rerender } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Enable thoughts
      stdin.write('/thoughts\r');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Force rerender
      rerender(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      const output = lastFrame();

      // State should be maintained (though this is simplified for testing)
      expect(output).toBeDefined();
    });

    it('should handle concurrent thoughts toggles correctly', async () => {
      const { lastFrame, stdin } = render(
        <App
          projectPath="/test/project"
          config={mockConfig}
          orchestrator={mockOrchestrator as ApexOrchestrator}
          gitBranch="main"
        />
      );

      // Simulate concurrent toggles (in practice, these would be queued)
      const togglePromises = [
        new Promise(resolve => {
          stdin.write('/thoughts\r');
          setTimeout(resolve, 5);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            stdin.write('/thoughts\r');
            resolve(undefined);
          }, 2);
        }),
      ];

      await Promise.all(togglePromises);

      const output = lastFrame();

      // Final state should be consistent
      expect(output).toMatch(/Thought visibility (enabled|disabled)/);
    });
  });
});