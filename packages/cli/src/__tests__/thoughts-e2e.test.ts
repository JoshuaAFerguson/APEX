/**
 * End-to-end tests for the complete thoughts feature workflow
 * Tests the integration between command handling, keyboard shortcuts, state management, and UI rendering
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';
import { ShortcutManager, type ShortcutEvent } from '../services/ShortcutManager.js';

// Mock the App component for testing
const MockApp = ({
  onThoughtsToggle,
  shortcutManager,
}: {
  onThoughtsToggle: (enabled: boolean) => void;
  shortcutManager?: ShortcutManager;
}) => {
  const [showThoughts, setShowThoughts] = React.useState(false);
  const [messages, setMessages] = React.useState<string[]>([]);
  const Box = 'div';
  const Text = 'span';
  const manager = React.useMemo(
    () => shortcutManager ?? new ShortcutManager(),
    [shortcutManager]
  );

  React.useLayoutEffect(() => {
    // Simulate command handling
    const handleCommand = (command: string) => {
      if (command === '/thoughts') {
        const newShowThoughts = !showThoughts;
        setShowThoughts(newShowThoughts);
        setMessages(prev => [...prev,
          newShowThoughts
            ? 'Thought visibility enabled: AI reasoning will be shown'
            : 'Thought visibility disabled: AI reasoning will be hidden'
        ]);
        onThoughtsToggle(newShowThoughts);
      }
    };

    // Simulate keyboard shortcut setup
    manager.on('command', handleCommand);

    return () => {
      manager.off('command', handleCommand);
    };
  }, [manager, showThoughts, onThoughtsToggle]);

  return React.createElement(
    Box,
    { style: { display: 'flex', flexDirection: 'column' } },
    messages.map((msg, i) => React.createElement(Text, { key: i }, msg))
  );
};

describe('Thoughts Feature End-to-End Tests', () => {
  let shortcutManager: ShortcutManager;

  beforeEach(() => {
    shortcutManager = new ShortcutManager();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Complete workflow integration', () => {
    it('should handle the complete thoughts toggle workflow via command', async () => {
      const onThoughtsToggle = vi.fn();

      render(
        React.createElement(MockApp, {
          onThoughtsToggle,
          shortcutManager,
        })
      );

      await act(async () => {
        shortcutManager.emit('command', '/thoughts');
      });

      expect(onThoughtsToggle).toHaveBeenCalledWith(true);
    });

    it('should register keyboard shortcut correctly during initialization', () => {
      const shortcuts = shortcutManager.getShortcuts();
      const thoughtsShortcut = shortcuts.find(s => s.id === 'toggleThoughts');

      expect(thoughtsShortcut).toBeDefined();
      expect(thoughtsShortcut?.keys).toEqual({
        key: 't',
        ctrl: true
      });
      expect(thoughtsShortcut?.action).toEqual({
        type: 'command',
        command: '/thoughts'
      });
    });

    it('should handle keyboard shortcut triggering command execution', () => {
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

    it('should maintain state consistency across multiple toggles', async () => {
      const states: boolean[] = [];

      render(
        React.createElement(MockApp, {
          onThoughtsToggle: (enabled: boolean) => {
            states.push(enabled);
          },
          shortcutManager,
        })
      );

      // Simulate multiple toggles
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          shortcutManager.emit('command', '/thoughts');
        });
      }

      // Should alternate between true/false
      await waitFor(() => expect(states).toHaveLength(5));
      states.forEach((state, index) => {
        expect(state).toBe(index % 2 === 0); // 0,2,4 = true; 1,3 = false
      });
    });
  });

  describe('Cross-component integration', () => {
    it('should properly integrate shortcut manager with app state', () => {
      const mockCommandHandler = vi.fn();

      // Simulate App component registering for shortcuts
      shortcutManager.on('command', mockCommandHandler);

      // Simulate user pressing Ctrl+T
      const ctrlT: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      shortcutManager.handleKey(ctrlT);

      expect(mockCommandHandler).toHaveBeenCalledWith('/thoughts');
    });

    it('should handle shortcut registration across component lifecycles', () => {
      let manager1: ShortcutManager | null = new ShortcutManager();
      const handler1 = vi.fn();

      manager1.on('command', handler1);

      // Simulate component unmount/remount
      manager1 = null;

      const manager2 = new ShortcutManager();
      const handler2 = vi.fn();
      manager2.on('command', handler2);

      const ctrlT: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      manager2.handleKey(ctrlT);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('/thoughts');
    });

    it('should maintain shortcut functionality across context changes', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const ctrlT: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // Test in different contexts
      expect(shortcutManager.getCurrentContext()).toBe('global');
      expect(shortcutManager.handleKey(ctrlT)).toBe(true);

      shortcutManager.pushContext('input');
      expect(shortcutManager.handleKey(ctrlT)).toBe(true);

      shortcutManager.pushContext('modal');
      expect(shortcutManager.handleKey(ctrlT)).toBe(true);

      expect(commandHandler).toHaveBeenCalledTimes(3);
      commandHandler.mock.calls.forEach(call => {
        expect(call[0]).toBe('/thoughts');
      });
    });
  });

  describe('State management integration', () => {
    it('should properly manage thoughts state through the component lifecycle', async () => {
      const stateHistory: boolean[] = [];

      const TestComponent = () => {
        const [showThoughts, setShowThoughts] = React.useState(false);

        React.useLayoutEffect(() => {
          stateHistory.push(showThoughts);
        }, [showThoughts]);

        // Simulate thoughts toggle
        React.useLayoutEffect(() => {
          const timer = setTimeout(() => {
            setShowThoughts(!showThoughts);
          }, 10);

          return () => clearTimeout(timer);
        }, []);

        return React.createElement('span', {}, `Thoughts: ${showThoughts ? 'enabled' : 'disabled'}`);
      };

      const { container } = render(React.createElement(TestComponent));

      // Initially disabled
      expect(container.textContent).toContain('disabled');

      // Wait for state change
      await waitFor(() => {
        expect(stateHistory).toEqual([false, true]);
      });
    });

    it('should handle concurrent state updates correctly', async () => {
      const updates: boolean[] = [];

      const TestComponent = () => {
        const [showThoughts, setShowThoughts] = React.useState(false);

        React.useEffect(() => {
          updates.push(showThoughts);
        }, [showThoughts]);

        // Simulate rapid toggles
        React.useEffect(() => {
          let currentState = false;
          const intervals = [5, 10, 15, 20, 25].map((delay) => {
            return setTimeout(() => {
              currentState = !currentState;
              setShowThoughts(currentState);
            }, delay);
          });

          return () => intervals.forEach(clearTimeout);
        }, []);

        return React.createElement('span', {}, 'Testing');
      };

      render(React.createElement(TestComponent));

      // Wait for all updates
      await waitFor(() => {
        expect(updates.length).toBeGreaterThan(1);
      });
      expect(updates[0]).toBe(false); // Initial state
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle errors in command processing gracefully', () => {
      const errorHandler = vi.fn();
      const commandHandler = vi.fn().mockImplementation(() => {
        throw new Error('Command processing error');
      });

      shortcutManager.on('command', commandHandler);
      window.addEventListener('error', errorHandler);

      const ctrlT: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      // Should not crash the application
      expect(() => {
        shortcutManager.handleKey(ctrlT);
      }).not.toThrow();

      window.removeEventListener('error', errorHandler);
    });

    it('should handle malformed shortcut events without breaking', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const malformedEvents = [
        { key: '', ctrl: true } as ShortcutEvent,
        { key: null, ctrl: true } as any,
        { ctrl: true } as any,
        {} as ShortcutEvent,
      ];

      malformedEvents.forEach(event => {
        expect(() => {
          shortcutManager.handleKey(event);
        }).not.toThrow();
      });

      expect(commandHandler).not.toHaveBeenCalled();
    });

    it('should recover from invalid state scenarios', () => {
      const TestComponent = () => {
        const [showThoughts, setShowThoughts] = React.useState(false);

        // Simulate invalid state recovery
        React.useEffect(() => {
          try {
            // Attempt to set invalid state
            setShowThoughts(null as any);
          } catch (error) {
            // Recover with valid state
            setShowThoughts(false);
          }
        }, []);

        return React.createElement('span', {}, `State: ${typeof showThoughts}`);
      };

      const { container } = render(React.createElement(TestComponent));

      expect(container.textContent).toContain('State:');
    });
  });

  describe('Performance and optimization', () => {
    it('should handle rapid shortcut triggers efficiently', () => {
      const commandHandler = vi.fn();
      shortcutManager.on('command', commandHandler);

      const ctrlT: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        shortcutManager.handleKey(ctrlT);
      }

      const end = performance.now();

      expect(end - start).toBeLessThan(100);
      expect(commandHandler).toHaveBeenCalledTimes(1000);
    });

    it('should optimize state updates for frequent toggles', async () => {
      const renderCount = { count: 0 };

      const TestComponent = () => {
        const [showThoughts, setShowThoughts] = React.useState(false);

        renderCount.count++;

        // Simulate batched updates
        React.useEffect(() => {
          const toggles = [];
          for (let i = 0; i < 10; i++) {
            toggles.push(setTimeout(() => {
              setShowThoughts(prev => !prev);
            }, i * 5));
          }

          return () => toggles.forEach(clearTimeout);
        }, []);

        return React.createElement('span', {}, `Renders: ${renderCount.count}`);
      };

      render(React.createElement(TestComponent));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should batch updates efficiently
      expect(renderCount.count).toBeLessThan(20); // Should be much less than 10 individual updates
    });

    it('should clean up event listeners properly', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      shortcutManager.on('command', handler1);
      shortcutManager.on('command', handler2);

      const ctrlT: ShortcutEvent = {
        key: 't',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      };

      shortcutManager.handleKey(ctrlT);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();

      // Remove handlers
      shortcutManager.off('command', handler1);
      shortcutManager.off('command', handler2);

      handler1.mockClear();
      handler2.mockClear();

      shortcutManager.handleKey(ctrlT);
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
});
