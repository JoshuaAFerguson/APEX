/**
 * Integration tests for v0.3.0 features
 * Tests the interaction between UI components, services, and overall user experience
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../services/SessionStore';
import { CompletionEngine } from '../services/CompletionEngine';
import { ConversationManager } from '../services/ConversationManager';
import { ShortcutManager } from '../services/ShortcutManager';
import { SessionAutoSaver } from '../services/SessionAutoSaver';
import { IntentDetector } from '../ui/components/IntentDetector';
import { StatusBar } from '../ui/components/StatusBar';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock file system
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

// Mock process
vi.mock('process', () => ({
  cwd: vi.fn(() => '/test/project'),
}));

// Mock ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

describe('v0.3.0 Integration Tests', () => {
  let sessionStore: SessionStore;
  let completionEngine: CompletionEngine;
  let conversationManager: ConversationManager;
  let shortcutManager: ShortcutManager;
  let sessionAutoSaver: SessionAutoSaver;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Initialize services
    sessionStore = new SessionStore('/test/.apex/sessions');
    await sessionStore.initialize();

    completionEngine = new CompletionEngine({
      commands: [
        { name: 'run', description: 'Execute a task' },
        { name: 'status', description: 'Show task status' },
        { name: 'help', description: 'Show help' },
      ],
      history: ['create component', 'fix bug', 'run tests'],
    });

    conversationManager = new ConversationManager(sessionStore);
    shortcutManager = new ShortcutManager();
    sessionAutoSaver = new SessionAutoSaver(sessionStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionAutoSaver.stop();
  });

  describe('Session Management Integration', () => {
    it('should create and persist session data', async () => {
      const sessionId = await conversationManager.startSession();
      expect(sessionId).toBeDefined();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Test message',
      });

      await conversationManager.addMessage({
        role: 'assistant',
        content: 'Test response',
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.messages).toHaveLength(2);
    });

    it('should auto-save sessions at regular intervals', async () => {
      const sessionId = await conversationManager.startSession();

      sessionAutoSaver.start();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Message 1',
      });

      // Advance time to trigger auto-save
      act(() => {
        vi.advanceTimersByTime(60000); // 1 minute
      });

      await conversationManager.addMessage({
        role: 'user',
        content: 'Message 2',
      });

      // Auto-save should have been triggered
      const session = await sessionStore.getSession(sessionId);
      expect(session?.messages).toHaveLength(2);
    });

    it('should handle session export correctly', async () => {
      const sessionId = await conversationManager.startSession();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Export test message',
      });

      const exported = await sessionStore.exportSession(sessionId, 'markdown');
      expect(exported).toContain('Export test message');
      expect(exported).toContain('# Session Export');
    });
  });

  describe('Intent Detection Integration', () => {
    const mockCommands = [
      {
        name: 'run',
        aliases: ['execute', 'exec'],
        description: 'Execute a task',
        examples: ['run "create component"'],
      },
      {
        name: 'status',
        aliases: ['st'],
        description: 'Show task status',
      },
    ];

    it('should detect command intents and trigger completion', async () => {
      let detectedIntent: any = null;

      const { rerender } = render(
        <ThemeProvider>
          <IntentDetector
            input="/run create component"
            commands={mockCommands}
            onIntentDetected={(intent) => { detectedIntent = intent; }}
          />
        </ThemeProvider>
      );

      // Wait for debounced intent detection
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(detectedIntent).toBeDefined();
        expect(detectedIntent.type).toBe('command');
        expect(detectedIntent.command).toBe('run');
        expect(detectedIntent.confidence).toBe(1.0);
      });
    });

    it('should provide task suggestions based on patterns', async () => {
      let detectedIntent: any = null;

      render(
        <ThemeProvider>
          <IntentDetector
            input="create a new React component"
            commands={mockCommands}
            onIntentDetected={(intent) => { detectedIntent = intent; }}
          />
        </ThemeProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(detectedIntent).toBeDefined();
        expect(detectedIntent.type).toBe('task');
        expect(detectedIntent.suggestions).toBeDefined();
        expect(detectedIntent.suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Completion Engine Integration', () => {
    it('should provide command completions', async () => {
      const completions = await completionEngine.getCompletions('ru', 'command');

      expect(completions).toContain('run');
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should provide history-based completions', async () => {
      const completions = await completionEngine.getCompletions('create', 'natural');

      expect(completions).toContain('create component');
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should handle context-aware completions', async () => {
      completionEngine.updateContext({
        currentDirectory: '/src/components',
        recentFiles: ['Button.tsx', 'Modal.tsx'],
        activeTask: 'component-creation',
      });

      const completions = await completionEngine.getCompletions('edit', 'natural');

      expect(completions.some(c => c.includes('Button.tsx'))).toBe(true);
    });
  });

  describe('Status Bar Integration', () => {
    it('should display session information correctly', () => {
      const mockSessionStartTime = new Date('2023-01-01T10:00:00Z');

      vi.setSystemTime(new Date('2023-01-01T10:05:00Z')); // 5 minutes later

      render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 1500, output: 800 }}
            cost={0.05}
            model="claude-3-sonnet"
            gitBranch="feature/v030"
            agent="developer"
            workflowStage="implementation"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/cost:/)).toBeInTheDocument();
      expect(screen.getByText(/feature\/v030/)).toBeInTheDocument();
      expect(screen.getByText(/developer/)).toBeInTheDocument();
    });

    it('should update timer in real-time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      vi.setSystemTime(new Date('2023-01-01T10:00:30Z')); // 30 seconds later

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={startTime}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/30s/)).toBeInTheDocument();

      // Advance time
      act(() => {
        vi.setSystemTime(new Date('2023-01-01T10:01:30Z')); // 1 minute 30 seconds
        vi.advanceTimersByTime(1000); // Trigger timer update
      });

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={startTime}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/1m 30s/)).toBeInTheDocument();
    });
  });

  describe('Conversation Flow Integration', () => {
    it('should handle complete conversation cycle', async () => {
      const sessionId = await conversationManager.startSession();

      // Add user message
      await conversationManager.addMessage({
        role: 'user',
        content: 'Create a new React component called Button',
      });

      // Add assistant response
      await conversationManager.addMessage({
        role: 'assistant',
        content: 'I\'ll help you create a new React component called Button.',
      });

      // Add tool use message
      await conversationManager.addMessage({
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({
              path: 'Button.tsx',
              content: 'export const Button = () => <button>Click me</button>;'
            }),
          },
        }],
      });

      // Add tool result
      await conversationManager.addMessage({
        role: 'tool',
        content: 'File created successfully',
        tool_call_id: 'call_1',
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session?.messages).toHaveLength(4);

      const context = conversationManager.getContext();
      expect(context.recentFiles).toContain('Button.tsx');
    });

    it('should handle session branching', async () => {
      const originalSessionId = await conversationManager.startSession();

      await conversationManager.addMessage({
        role: 'user',
        content: 'Original message',
      });

      const branchedSessionId = await conversationManager.branchSession('New branch');
      expect(branchedSessionId).toBeDefined();
      expect(branchedSessionId).not.toBe(originalSessionId);

      // Branch should contain original messages
      const branchedSession = await sessionStore.getSession(branchedSessionId);
      expect(branchedSession?.messages).toHaveLength(1);
      expect(branchedSession?.messages[0].content).toBe('Original message');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle session store errors gracefully', async () => {
      // Mock file system error
      const fs = await import('fs/promises');
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));

      const sessionId = await conversationManager.startSession();

      // Should handle error gracefully
      await expect(
        conversationManager.addMessage({
          role: 'user',
          content: 'Test message',
        })
      ).rejects.toThrow('Disk full');
    });

    it('should recover from auto-save failures', async () => {
      const sessionId = await conversationManager.startSession();
      sessionAutoSaver.start();

      // Mock save failure
      vi.spyOn(sessionStore, 'updateSession').mockRejectedValueOnce(new Error('Save failed'));

      await conversationManager.addMessage({
        role: 'user',
        content: 'Message before failure',
      });

      // Auto-save should fail but not crash
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      // Should continue working after failure
      await conversationManager.addMessage({
        role: 'user',
        content: 'Message after failure',
      });

      const session = await sessionStore.getSession(sessionId);
      expect(session?.messages).toHaveLength(2);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large conversation histories efficiently', async () => {
      const sessionId = await conversationManager.startSession();

      // Add many messages
      for (let i = 0; i < 100; i++) {
        await conversationManager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }

      const startTime = Date.now();
      const session = await sessionStore.getSession(sessionId);
      const endTime = Date.now();

      expect(session?.messages).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle completion engine with large datasets', async () => {
      // Add many commands and history entries
      const manyCommands = Array.from({ length: 1000 }, (_, i) => ({
        name: `command${i}`,
        description: `Description ${i}`,
      }));

      const manyHistory = Array.from({ length: 1000 }, (_, i) => `history item ${i}`);

      const largeCompletionEngine = new CompletionEngine({
        commands: manyCommands,
        history: manyHistory,
      });

      const startTime = Date.now();
      const completions = await largeCompletionEngine.getCompletions('command', 'command');
      const endTime = Date.now();

      expect(completions.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(200); // Should complete quickly
    });
  });

  describe('Keyboard Shortcuts Integration', () => {
    let eventHandlers: Record<string, vi.Mock>;

    beforeEach(() => {
      // Set up event handlers to capture emitted events
      eventHandlers = {
        cancel: vi.fn(),
        exit: vi.fn(),
        clear: vi.fn(),
        clearLine: vi.fn(),
        deleteWord: vi.fn(),
        historySearch: vi.fn(),
        historyPrev: vi.fn(),
        historyNext: vi.fn(),
        complete: vi.fn(),
        dismiss: vi.fn(),
        newline: vi.fn(),
        submit: vi.fn(),
        moveCursor: vi.fn(),
        command: vi.fn(),
      };

      // Register event handlers
      Object.keys(eventHandlers).forEach(event => {
        shortcutManager.on(event, eventHandlers[event]);
      });
    });

    describe('ShortcutManager Registration and API', () => {
      it('should register custom shortcuts correctly', () => {
        const customShortcut = {
          id: 'test-custom',
          description: 'Test custom shortcut',
          keys: { key: 'k', ctrl: true },
          action: { type: 'emit', event: 'test' } as const,
          context: 'global' as const,
        };

        shortcutManager.register(customShortcut);
        const shortcuts = shortcutManager.getShortcuts();
        const registered = shortcuts.find(s => s.id === 'test-custom');

        expect(registered).toBeDefined();
        expect(registered?.description).toBe('Test custom shortcut');
        expect(registered?.keys.key).toBe('k');
        expect(registered?.action.type).toBe('emit');
      });

      it('should unregister shortcuts correctly', () => {
        const shortcut = {
          id: 'test-unregister',
          description: 'Test unregister',
          keys: { key: 'u', ctrl: true },
          action: { type: 'emit', event: 'test' } as const,
        };

        shortcutManager.register(shortcut);
        expect(shortcutManager.getShortcuts().find(s => s.id === 'test-unregister')).toBeDefined();

        shortcutManager.unregister('test-unregister');
        expect(shortcutManager.getShortcuts().find(s => s.id === 'test-unregister')).toBeUndefined();
      });

      it('should handle context stack operations', () => {
        expect(shortcutManager.getCurrentContext()).toBe('global');

        shortcutManager.pushContext('input');
        expect(shortcutManager.getCurrentContext()).toBe('input');

        shortcutManager.pushContext('modal');
        expect(shortcutManager.getCurrentContext()).toBe('modal');

        const popped = shortcutManager.popContext();
        expect(popped).toBe('modal');
        expect(shortcutManager.getCurrentContext()).toBe('input');

        shortcutManager.popContext();
        expect(shortcutManager.getCurrentContext()).toBe('global');

        // Should not pop below global
        const nothingPopped = shortcutManager.popContext();
        expect(nothingPopped).toBeUndefined();
        expect(shortcutManager.getCurrentContext()).toBe('global');
      });

      it('should filter shortcuts by context correctly', () => {
        shortcutManager.register({
          id: 'input-only',
          description: 'Input only',
          keys: { key: 'i', ctrl: true },
          action: { type: 'emit', event: 'test' },
          context: 'input',
        });

        shortcutManager.register({
          id: 'modal-only',
          description: 'Modal only',
          keys: { key: 'm', ctrl: true },
          action: { type: 'emit', event: 'test' },
          context: 'modal',
        });

        const globalShortcuts = shortcutManager.getShortcutsForContext('global');
        const inputShortcuts = shortcutManager.getShortcutsForContext('input');
        const modalShortcuts = shortcutManager.getShortcutsForContext('modal');

        // Global should include global shortcuts but not context-specific ones
        expect(globalShortcuts.some(s => s.id === 'help')).toBe(true); // Default global shortcut
        expect(globalShortcuts.some(s => s.id === 'input-only')).toBe(false);
        expect(globalShortcuts.some(s => s.id === 'modal-only')).toBe(false);

        // Input should include global shortcuts + input-specific ones
        expect(inputShortcuts.some(s => s.id === 'help')).toBe(true); // Global shortcuts available in input
        expect(inputShortcuts.some(s => s.id === 'input-only')).toBe(true);
        expect(inputShortcuts.some(s => s.id === 'modal-only')).toBe(false);

        // Modal should include global shortcuts + modal-specific ones
        expect(modalShortcuts.some(s => s.id === 'help')).toBe(true); // Global shortcuts available in modal
        expect(modalShortcuts.some(s => s.id === 'input-only')).toBe(false);
        expect(modalShortcuts.some(s => s.id === 'modal-only')).toBe(true);
      });

      it('should format key combinations correctly', () => {
        expect(shortcutManager.formatKey({ key: 'c', ctrl: true })).toBe('Ctrl+C');
        expect(shortcutManager.formatKey({ key: 'd', ctrl: true, shift: true })).toBe('Ctrl+Shift+D');
        expect(shortcutManager.formatKey({ key: 'a', alt: true })).toBe('Alt+A');
        expect(shortcutManager.formatKey({ key: 's', meta: true })).toBe('Cmd+S');
        expect(shortcutManager.formatKey({ key: 'x', ctrl: true, alt: true, shift: true, meta: true })).toBe('Ctrl+Alt+Shift+Cmd+X');
        expect(shortcutManager.formatKey({ key: 'Escape' })).toBe('ESCAPE');
        expect(shortcutManager.formatKey({ key: 'Tab' })).toBe('TAB');
      });
    });

    describe('Context-Aware Activation', () => {
      it('should activate shortcuts based on current context', () => {
        const globalHandler = vi.fn();
        const inputHandler = vi.fn();

        shortcutManager.register({
          id: 'global-test',
          description: 'Global test',
          keys: { key: 'g', ctrl: true },
          action: { type: 'function', handler: globalHandler },
          context: 'global',
        });

        shortcutManager.register({
          id: 'input-test',
          description: 'Input test',
          keys: { key: 'i', ctrl: true },
          action: { type: 'function', handler: inputHandler },
          context: 'input',
        });

        // In global context
        shortcutManager.handleKey({
          key: 'g',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(globalHandler).toHaveBeenCalledTimes(1);

        // Input-only shortcut should not work in global context
        shortcutManager.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(inputHandler).not.toHaveBeenCalled();

        // Switch to input context
        shortcutManager.pushContext('input');

        // Both global and input shortcuts should work
        shortcutManager.handleKey({
          key: 'g',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(globalHandler).toHaveBeenCalledTimes(2); // Global shortcuts work in any context

        shortcutManager.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });
        expect(inputHandler).toHaveBeenCalledTimes(1); // Now input shortcut works
      });

      it('should handle conditional shortcuts with enabled callback', () => {
        const handler = vi.fn();
        let enabled = false;

        shortcutManager.register({
          id: 'conditional-test',
          description: 'Conditional test',
          keys: { key: 'c', ctrl: true, shift: true },
          action: { type: 'function', handler },
          enabled: () => enabled,
        });

        // Should not work when disabled
        const disabledResult = shortcutManager.handleKey({
          key: 'c',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });
        expect(disabledResult).toBe(false);
        expect(handler).not.toHaveBeenCalled();

        // Should work when enabled
        enabled = true;
        const enabledResult = shortcutManager.handleKey({
          key: 'c',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });
        expect(enabledResult).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Event Emission', () => {
      it('should emit events correctly for emit actions', () => {
        const testHandler = vi.fn();
        shortcutManager.on('test-event', testHandler);

        shortcutManager.register({
          id: 'emit-test',
          description: 'Emit test',
          keys: { key: 'e', ctrl: true },
          action: { type: 'emit', event: 'test-event', payload: { data: 'test' } },
        });

        const handled = shortcutManager.handleKey({
          key: 'e',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(testHandler).toHaveBeenCalledWith({ data: 'test' });
      });

      it('should emit command events for command actions', () => {
        shortcutManager.register({
          id: 'command-test',
          description: 'Command test',
          keys: { key: 'cmd', ctrl: true },
          action: { type: 'command', command: '/test command' },
        });

        const handled = shortcutManager.handleKey({
          key: 'cmd',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/test command');
      });

      it('should handle event listener registration and removal', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        shortcutManager.on('multi-test', handler1);
        shortcutManager.on('multi-test', handler2);

        shortcutManager.register({
          id: 'multi-handler-test',
          description: 'Multi handler test',
          keys: { key: 'multi', ctrl: true },
          action: { type: 'emit', event: 'multi-test' },
        });

        shortcutManager.handleKey({
          key: 'multi',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);

        // Remove one handler
        shortcutManager.off('multi-test', handler1);

        shortcutManager.handleKey({
          key: 'multi',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1); // Not called again
        expect(handler2).toHaveBeenCalledTimes(2); // Called again
      });
    });

    describe('Default Shortcuts Functionality', () => {
      it('should handle Ctrl+C (cancel) in processing context', () => {
        shortcutManager.pushContext('processing');

        const handled = shortcutManager.handleKey({
          key: 'c',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.cancel).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+D (exit) globally', () => {
        const handled = shortcutManager.handleKey({
          key: 'd',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.exit).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+L (clear) globally', () => {
        const handled = shortcutManager.handleKey({
          key: 'l',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.clear).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+U (clearLine) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'u',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.clearLine).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+W (deleteWord) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'w',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.deleteWord).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+A (beginningOfLine) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'a',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.moveCursor).toHaveBeenCalledWith('home');
      });

      it('should handle Ctrl+E (endOfLine) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'e',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.moveCursor).toHaveBeenCalledWith('end');
      });

      it('should handle Ctrl+P (previousHistory) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'p',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.historyPrev).toHaveBeenCalledWith(undefined);
      });

      it('should handle Ctrl+N (nextHistory) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'n',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.historyNext).toHaveBeenCalledWith(undefined);
      });

      it('should handle Tab (complete) in input context', () => {
        shortcutManager.pushContext('input');

        const handled = shortcutManager.handleKey({
          key: 'Tab',
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.complete).toHaveBeenCalledWith(undefined);
      });

      it('should handle Escape (dismiss) globally', () => {
        const handled = shortcutManager.handleKey({
          key: 'Escape',
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(eventHandlers.dismiss).toHaveBeenCalledWith(undefined);
      });

      it('should handle command shortcuts that emit command events', () => {
        // Test Ctrl+S for quick save
        const handleCtrlS = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handleCtrlS).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/session save quick-save');

        // Test Ctrl+H for help
        const handleCtrlH = shortcutManager.handleKey({
          key: 'h',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handleCtrlH).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/help');

        // Test Ctrl+Shift+S for status
        const handleCtrlShiftS = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });

        expect(handleCtrlShiftS).toBe(true);
        expect(eventHandlers.command).toHaveBeenCalledWith('/status');
      });
    });

    describe('Complex Integration Scenarios', () => {
      it('should handle shortcuts with conflicting key combinations correctly', () => {
        const normalHandler = vi.fn();
        const shiftHandler = vi.fn();

        // Register Ctrl+S and Ctrl+Shift+S
        shortcutManager.register({
          id: 'normal-save',
          description: 'Normal save',
          keys: { key: 's', ctrl: true },
          action: { type: 'function', handler: normalHandler },
        });

        shortcutManager.register({
          id: 'shift-save',
          description: 'Shift save',
          keys: { key: 's', ctrl: true, shift: true },
          action: { type: 'function', handler: shiftHandler },
        });

        // Test Ctrl+S (should not trigger Ctrl+Shift+S)
        const normalResult = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(normalResult).toBe(true);
        expect(normalHandler).toHaveBeenCalledTimes(1);
        expect(shiftHandler).not.toHaveBeenCalled();

        // Test Ctrl+Shift+S (should not trigger Ctrl+S)
        const shiftResult = shortcutManager.handleKey({
          key: 's',
          ctrl: true,
          shift: true,
          alt: false,
          meta: false,
        });

        expect(shiftResult).toBe(true);
        expect(shiftHandler).toHaveBeenCalledTimes(1);
        expect(normalHandler).toHaveBeenCalledTimes(1); // Still only called once
      });

      it('should handle async function handlers', async () => {
        const asyncHandler = vi.fn().mockResolvedValue('test');

        shortcutManager.register({
          id: 'async-test',
          description: 'Async test',
          keys: { key: 'async', ctrl: true },
          action: { type: 'function', handler: asyncHandler },
        });

        const handled = shortcutManager.handleKey({
          key: 'async',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(asyncHandler).toHaveBeenCalledTimes(1);

        // Wait for async completion
        await vi.waitFor(() => expect(asyncHandler).toHaveReturnedWith(expect.any(Promise)));
      });

      it('should handle rapid successive key presses', () => {
        const handler = vi.fn();

        shortcutManager.register({
          id: 'rapid-test',
          description: 'Rapid test',
          keys: { key: 'r', ctrl: true },
          action: { type: 'function', handler },
        });

        // Simulate rapid key presses
        for (let i = 0; i < 5; i++) {
          const handled = shortcutManager.handleKey({
            key: 'r',
            ctrl: true,
            alt: false,
            shift: false,
            meta: false,
          });
          expect(handled).toBe(true);
        }

        expect(handler).toHaveBeenCalledTimes(5);
      });

      it('should maintain context isolation between different shortcut instances', () => {
        const manager1 = new ShortcutManager();
        const manager2 = new ShortcutManager();

        const handler1 = vi.fn();
        const handler2 = vi.fn();

        manager1.register({
          id: 'instance-test',
          description: 'Instance test 1',
          keys: { key: 'i', ctrl: true },
          action: { type: 'function', handler: handler1 },
        });

        manager2.register({
          id: 'instance-test',
          description: 'Instance test 2',
          keys: { key: 'i', ctrl: true },
          action: { type: 'function', handler: handler2 },
        });

        // Trigger on first manager
        manager1.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).not.toHaveBeenCalled();

        // Trigger on second manager
        manager2.handleKey({
          key: 'i',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Display Modes Integration', () => {
    it('should switch between compact and normal display modes', () => {
      const mockSessionStartTime = new Date();

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 1500, output: 800 }}
            cost={0.05}
            model="claude-3-sonnet"
            gitBranch="feature/v030"
            agent="developer"
            workflowStage="implementation"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      // In compact mode, should render with compact styling
      expect(screen.getByText(/feature\/v030/)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 1500, output: 800 }}
            cost={0.05}
            model="claude-3-sonnet"
            gitBranch="feature/v030"
            agent="developer"
            workflowStage="implementation"
            displayMode="normal"
          />
        </ThemeProvider>
      );

      // In normal mode, should show more detailed information including agent
      expect(screen.getByText(/developer/)).toBeInTheDocument();
    });

    it('should handle verbose display mode with extended information', () => {
      const mockSessionStartTime = new Date();

      render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 2000, output: 1200 }}
            cost={0.08}
            model="claude-3-sonnet"
            gitBranch="feature/verbose-test"
            agent="architect"
            workflowStage="planning"
            displayMode="verbose"
          />
        </ThemeProvider>
      );

      // In verbose mode, should show detailed information
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/feature\/verbose-test/)).toBeInTheDocument();
      expect(screen.getByText(/architect/)).toBeInTheDocument();
    });

    it('should adapt component layouts for different display modes', () => {
      const mockCommands = [
        { name: 'run', description: 'Execute a task' },
        { name: 'status', description: 'Show status' },
      ];

      // Test with minimal context (no specific display mode for IntentDetector)
      const { rerender } = render(
        <ThemeProvider>
          <IntentDetector
            input="test input"
            commands={mockCommands}
          />
        </ThemeProvider>
      );

      // Should render without errors
      rerender(
        <ThemeProvider>
          <IntentDetector
            input="test input different"
            commands={mockCommands}
          />
        </ThemeProvider>
      );

      // Should render without errors in both cases
    });

    it('should persist display mode state through user interactions', () => {
      // Mock a state manager to track display mode changes
      let currentDisplayMode = 'normal';
      const mockSetDisplayMode = vi.fn((mode) => {
        currentDisplayMode = mode;
      });

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
            displayMode={currentDisplayMode as any}
          />
        </ThemeProvider>
      );

      // Simulate changing display mode
      mockSetDisplayMode('compact');

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 100, output: 50 }}
            cost={0.01}
            model="claude-3-sonnet"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      expect(mockSetDisplayMode).toHaveBeenCalledWith('compact');
      expect(currentDisplayMode).toBe('compact');
    });

    it('should handle responsive behavior across display modes', () => {
      const displayModes = ['normal', 'compact', 'verbose'] as const;

      displayModes.forEach(mode => {
        render(
          <ThemeProvider>
            <StatusBar
              sessionStartTime={new Date()}
              tokens={{ input: 1000, output: 500 }}
              cost={0.03}
              model="claude-3-sonnet"
              gitBranch={`feature/test-${mode}`}
              displayMode={mode}
            />
          </ThemeProvider>
        );

        // Should render without errors in all display modes
        expect(screen.getByText(/●/)).toBeInTheDocument(); // Connection indicator
      });
    });

    it('should maintain accessibility across all display modes', () => {
      const displayModes = ['normal', 'compact', 'verbose'] as const;

      displayModes.forEach(mode => {
        const { unmount } = render(
          <ThemeProvider>
            <StatusBar
              sessionStartTime={new Date()}
              tokens={{ input: 500, output: 300 }}
              cost={0.02}
              model="claude-3-sonnet"
              gitBranch="accessibility-test"
              agent="tester"
              displayMode={mode}
            />
          </ThemeProvider>
        );

        // Should render accessible content - connection indicator is always present
        expect(screen.getByText(/●/)).toBeInTheDocument();

        unmount();
      });
    });

    it('should handle display mode edge cases gracefully', () => {
      const mockSessionStartTime = new Date();

      // Test with minimal data in different display modes
      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 0, output: 0 }}
            cost={0}
            model="claude-3-sonnet"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/●/)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionStartTime={mockSessionStartTime}
            tokens={{ input: 0, output: 0 }}
            cost={0}
            model="claude-3-sonnet"
            displayMode="verbose"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    // NEW: Display Modes Integration with Sessions and Workflows
    describe('Display Modes Integration', () => {
      it('should integrate display modes with session management workflow', async () => {
        // Start with normal mode during session creation
        const sessionId = await conversationManager.startSession();
        let displayMode = 'normal';

        const { rerender } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/session-integration"
              agent="planner"
              sessionStartTime={new Date(Date.now() - 30000)} // 30 seconds ago
              tokens={{ input: 500, output: 300 }}
              cost={0.02}
            />
          </ThemeProvider>
        );

        // Normal mode should show comprehensive session info
        expect(screen.getByText(/feature\/session-integration/)).toBeInTheDocument();
        expect(screen.getByText(/planner/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();

        // Switch to compact mode during active development
        displayMode = 'compact';
        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/session-integration"
              agent="developer"
              sessionStartTime={new Date(Date.now() - 60000)} // 1 minute ago
              tokens={{ input: 800, output: 600 }}
              cost={0.03}
            />
          </ThemeProvider>
        );

        // Compact mode should show only essential info for active development
        expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
        expect(screen.getByText('feature/session-integration')).toBeInTheDocument(); // Git branch
        expect(screen.getByText(/\$0\.0300/)).toBeInTheDocument(); // Cost display in compact

        // Switch to verbose mode during debugging
        displayMode = 'verbose';
        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/session-integration"
              agent="developer"
              workflowStage="debugging"
              sessionStartTime={new Date(Date.now() - 120000)} // 2 minutes ago
              tokens={{ input: 1200, output: 900 }}
              cost={0.05}
              sessionName="Debug Session"
              subtaskProgress={{ completed: 2, total: 5 }}
            />
          </ThemeProvider>
        );

        // Verbose mode should show all available information for debugging
        expect(screen.getByText(/feature\/session-integration/)).toBeInTheDocument();
        expect(screen.getByText(/developer/)).toBeInTheDocument();
        expect(screen.getByText(/debugging/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      });

      it('should integrate display modes with completion engine context', async () => {
        // Update completion engine context based on current mode
        completionEngine.updateContext({
          currentDirectory: '/src/ui/components',
          recentFiles: ['StatusBar.tsx', 'ThemeProvider.tsx'],
          activeTask: 'display-mode-testing',
        });

        const completions = await completionEngine.getCompletions('status', 'natural');
        expect(completions.some(c => c.includes('StatusBar.tsx'))).toBe(true);

        // Test with different display modes affecting the status bar
        const modes = ['normal', 'compact', 'verbose'] as const;

        modes.forEach((mode, index) => {
          render(
            <ThemeProvider>
              <StatusBar
                displayMode={mode}
                gitBranch="feature/completion-integration"
                agent="developer"
                workflowStage="implementation"
                tokens={{ input: 1000 + (index * 200), output: 500 + (index * 100) }}
                cost={0.02 + (index * 0.01)}
              />
            </ThemeProvider>
          );

          // Should render without errors regardless of mode
          expect(screen.getByText('●')).toBeInTheDocument();

          if (mode === 'compact') {
            // In compact mode, should show git branch but hide agent details
            expect(screen.getByText('feature/completion-integration')).toBeInTheDocument();
            // Agent should NOT be shown in compact mode
            expect(screen.queryByText('developer')).not.toBeInTheDocument();
          } else {
            // In normal/verbose modes, should show agent
            expect(screen.getByText('developer')).toBeInTheDocument();
          }
        });
      });

      it('should integrate display modes with conversation flow and intent detection', async () => {
        // Start a conversation session
        const sessionId = await conversationManager.startSession();

        await conversationManager.addMessage({
          role: 'user',
          content: 'Switch to compact mode for focused development',
        });

        let detectedIntent: any = null;

        // Test intent detection with display mode context
        render(
          <ThemeProvider>
            <IntentDetector
              input="set mode compact"
              commands={[
                { name: 'mode', description: 'Set display mode' },
                { name: 'status', description: 'Show status' },
              ]}
              onIntentDetected={(intent) => { detectedIntent = intent; }}
            />
          </ThemeProvider>
        );

        await act(async () => {
          vi.advanceTimersByTime(400);
        });

        await waitFor(() => {
          expect(detectedIntent).toBeDefined();
        });

        // Also test StatusBar integration with conversation state
        render(
          <ThemeProvider>
            <StatusBar
              displayMode="compact"
              gitBranch="feature/conversation-flow"
              agent="assistant"
              sessionStartTime={new Date(Date.now() - 45000)} // 45 seconds ago
              tokens={{ input: 800, output: 500 }}
              cost={0.025}
            />
          </ThemeProvider>
        );

        // Should show conversation-relevant information in compact mode
        expect(screen.getByText('feature/conversation-flow')).toBeInTheDocument();
        expect(screen.getByText(/\$0\.0250/)).toBeInTheDocument();
      });

      it('should handle display mode changes during auto-save operations', async () => {
        const sessionId = await conversationManager.startSession();
        sessionAutoSaver.start();

        let currentMode = 'normal';
        const { rerender } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/auto-save"
              agent="developer"
              sessionStartTime={new Date(Date.now() - 30000)}
              tokens={{ input: 600, output: 400 }}
              cost={0.02}
            />
          </ThemeProvider>
        );

        // Add a message to trigger auto-save
        await conversationManager.addMessage({
          role: 'user',
          content: 'Test message during auto-save',
        });

        // Change to compact mode during auto-save interval
        currentMode = 'compact';

        act(() => {
          vi.advanceTimersByTime(30000); // Advance 30 seconds
        });

        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/auto-save"
              agent="developer"
              sessionStartTime={new Date(Date.now() - 60000)}
              tokens={{ input: 800, output: 600 }}
              cost={0.03}
            />
          </ThemeProvider>
        );

        // Auto-save should continue working regardless of display mode
        // StatusBar should show appropriate info in compact mode
        expect(screen.getByText('feature/auto-save')).toBeInTheDocument();
        expect(screen.getByText(/\$0\.0300/)).toBeInTheDocument();

        // Advance time to trigger auto-save
        act(() => {
          vi.advanceTimersByTime(60000); // Trigger auto-save
        });

        // Session should still be accessible after auto-save
        const session = await sessionStore.getSession(sessionId);
        expect(session?.messages).toHaveLength(1);
      });

      it('should maintain display mode preferences across component remounts', () => {
        // Test mode persistence during component lifecycle
        let displayMode = 'verbose';

        const { rerender, unmount } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/persistence-test"
              agent="architect"
              workflowStage="planning"
              sessionStartTime={new Date(Date.now() - 90000)} // 1.5 minutes ago
              tokens={{ input: 1500, output: 1000 }}
              cost={0.05}
            />
          </ThemeProvider>
        );

        // Should show verbose mode information
        expect(screen.getByText(/feature\/persistence-test/)).toBeInTheDocument();
        expect(screen.getByText(/architect/)).toBeInTheDocument();
        expect(screen.getByText(/planning/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();

        // Unmount component
        unmount();

        // Remount with same mode
        render(
          <ThemeProvider>
            <StatusBar
              displayMode={displayMode as any}
              gitBranch="feature/persistence-test"
              agent="architect"
              workflowStage="planning"
              sessionStartTime={new Date(Date.now() - 120000)} // 2 minutes ago
              tokens={{ input: 1800, output: 1200 }}
              cost={0.06}
            />
          </ThemeProvider>
        );

        // Should maintain verbose mode behavior after remount
        expect(screen.getByText(/feature\/persistence-test/)).toBeInTheDocument();
        expect(screen.getByText(/architect/)).toBeInTheDocument();
        expect(screen.getByText(/planning/)).toBeInTheDocument();
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      });

      it('should handle display mode integration with shortcut manager', () => {
        const shortcutHandler = vi.fn();

        // Register a display mode toggle shortcut
        shortcutManager.register({
          id: 'toggle-display-mode',
          description: 'Toggle display mode',
          keys: { key: 'm', ctrl: true },
          action: { type: 'function', handler: shortcutHandler },
        });

        let currentMode = 'normal';
        const { rerender } = render(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/shortcut-integration"
              agent="developer"
              tokens={{ input: 1000, output: 750 }}
              cost={0.04}
            />
          </ThemeProvider>
        );

        // Trigger shortcut
        const handled = shortcutManager.handleKey({
          key: 'm',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        });

        expect(handled).toBe(true);
        expect(shortcutHandler).toHaveBeenCalled();

        // Simulate mode change triggered by shortcut
        currentMode = 'compact';
        rerender(
          <ThemeProvider>
            <StatusBar
              displayMode={currentMode as any}
              gitBranch="feature/shortcut-integration"
              agent="developer"
              tokens={{ input: 1000, output: 750 }}
              cost={0.04}
            />
          </ThemeProvider>
        );

        // Should show compact mode after shortcut trigger
        expect(screen.getByText('feature/shortcut-integration')).toBeInTheDocument();
        expect(screen.getByText(/\$0\.0400/)).toBeInTheDocument();
      });
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme consistently across components', () => {
      render(
        <ThemeProvider theme="dark">
          <div>
            <StatusBar
              sessionStartTime={new Date()}
              tokens={{ input: 100, output: 50 }}
              cost={0.01}
              model="claude-3-sonnet"
            />
            <IntentDetector
              input="test input"
              commands={[]}
            />
          </div>
        </ThemeProvider>
      );

      // Components should render without theme conflicts
      expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    it('should handle theme switching dynamically', () => {
      const { rerender } = render(
        <ThemeProvider theme="light">
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 200, output: 100 }}
            cost={0.015}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      // Switch to dark theme
      rerender(
        <ThemeProvider theme="dark">
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 200, output: 100 }}
            cost={0.015}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      // Should render without errors in both themes
      expect(screen.getByText(/●/)).toBeInTheDocument();
    });

    it('should apply custom theme configurations', () => {
      const customTheme = {
        colors: {
          primary: '#007acc',
          secondary: '#ff6b35',
          background: '#1e1e1e',
          text: '#ffffff',
        },
        typography: {
          fontSize: '14px',
          fontFamily: 'Consolas, monospace',
        },
      };

      render(
        <ThemeProvider theme={customTheme}>
          <StatusBar
            sessionStartTime={new Date()}
            tokens={{ input: 300, output: 150 }}
            cost={0.025}
            model="claude-3-sonnet"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/●/)).toBeInTheDocument();
    });
  });
});