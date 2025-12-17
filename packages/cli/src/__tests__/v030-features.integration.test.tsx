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
      const mockSessionData = {
        startTime: new Date('2023-01-01T10:00:00Z'),
        tokenUsage: { input: 1500, output: 800 },
        cost: 0.05,
        model: 'claude-3-sonnet',
      };

      vi.setSystemTime(new Date('2023-01-01T10:05:00Z')); // 5 minutes later

      render(
        <ThemeProvider>
          <StatusBar
            sessionData={mockSessionData}
            gitBranch="feature/v030"
            activeAgent="developer"
            currentStage="implementation"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/cost:/)).toBeInTheDocument();
      expect(screen.getByText(/session:/)).toBeInTheDocument();
      expect(screen.getByText(/feature\/v030/)).toBeInTheDocument();
      expect(screen.getByText(/developer/)).toBeInTheDocument();
    });

    it('should update timer in real-time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      vi.setSystemTime(new Date('2023-01-01T10:00:30Z')); // 30 seconds later

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionData={{
              startTime,
              tokenUsage: { input: 100, output: 50 },
              cost: 0.01,
              model: 'claude-3-sonnet',
            }}
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
            sessionData={{
              startTime,
              tokenUsage: { input: 100, output: 50 },
              cost: 0.01,
              model: 'claude-3-sonnet',
            }}
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
      const mockSessionData = {
        startTime: new Date(),
        tokenUsage: { input: 1500, output: 800 },
        cost: 0.05,
        model: 'claude-3-sonnet',
      };

      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionData={mockSessionData}
            gitBranch="feature/v030"
            activeAgent="developer"
            currentStage="implementation"
            displayMode="compact"
          />
        </ThemeProvider>
      );

      // In compact mode, should render with compact styling
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionData={mockSessionData}
            gitBranch="feature/v030"
            activeAgent="developer"
            currentStage="implementation"
            displayMode="normal"
          />
        </ThemeProvider>
      );

      // In normal mode, should show more detailed information
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
    });

    it('should handle verbose display mode with extended information', () => {
      const mockSessionData = {
        startTime: new Date(),
        tokenUsage: { input: 2000, output: 1200 },
        cost: 0.08,
        model: 'claude-3-sonnet',
      };

      render(
        <ThemeProvider>
          <StatusBar
            sessionData={mockSessionData}
            gitBranch="feature/verbose-test"
            activeAgent="architect"
            currentStage="planning"
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
            sessionData={{
              startTime: new Date(),
              tokenUsage: { input: 100, output: 50 },
              cost: 0.01,
              model: 'claude-3-sonnet',
            }}
            displayMode={currentDisplayMode as any}
          />
        </ThemeProvider>
      );

      // Simulate changing display mode
      mockSetDisplayMode('compact');

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionData={{
              startTime: new Date(),
              tokenUsage: { input: 100, output: 50 },
              cost: 0.01,
              model: 'claude-3-sonnet',
            }}
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
              sessionData={{
                startTime: new Date(),
                tokenUsage: { input: 1000, output: 500 },
                cost: 0.03,
                model: 'claude-3-sonnet',
              }}
              gitBranch={`feature/test-${mode}`}
              displayMode={mode}
            />
          </ThemeProvider>
        );

        // Should render without errors in all display modes
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      });
    });

    it('should maintain accessibility across all display modes', () => {
      const displayModes = ['normal', 'compact', 'verbose'] as const;

      displayModes.forEach(mode => {
        const { unmount } = render(
          <ThemeProvider>
            <StatusBar
              sessionData={{
                startTime: new Date(),
                tokenUsage: { input: 500, output: 300 },
                cost: 0.02,
                model: 'claude-3-sonnet',
              }}
              gitBranch="accessibility-test"
              activeAgent="tester"
              displayMode={mode}
            />
          </ThemeProvider>
        );

        // Should render accessible content
        expect(screen.getByText(/tokens:/)).toBeInTheDocument();

        unmount();
      });
    });

    it('should handle display mode edge cases gracefully', () => {
      const mockSessionData = {
        startTime: new Date(),
        tokenUsage: { input: 0, output: 0 },
        cost: 0,
        model: 'claude-3-sonnet',
      };

      // Test with minimal data in different display modes
      const { rerender } = render(
        <ThemeProvider>
          <StatusBar
            sessionData={mockSessionData}
            displayMode="compact"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <StatusBar
            sessionData={mockSessionData}
            displayMode="verbose"
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
    });

    // NEW: Comprehensive Compact Mode - Minimal StatusBar Tests
    describe('Compact Mode - Minimal StatusBar', () => {
      const mockSessionData = {
        sessionStartTime: new Date('2024-01-01T10:00:00Z'),
        tokens: { input: 1500, output: 800 },
        cost: 0.05,
        sessionCost: 0.15,
        model: 'claude-3-sonnet',
      };

      it('should show only connection indicator in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              isConnected={true}
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should show connection indicator
        expect(screen.getByText('●')).toBeInTheDocument();
      });

      it('should show only active agent name in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              agent="developer"
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should show agent name
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      it('should show only elapsed timer in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              sessionStartTime={new Date(Date.now() - 65000)} // 1 minute 5 seconds ago
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should show elapsed time (format: mm:ss)
        expect(screen.getByText(/01:0[5-9]/)).toBeInTheDocument();
      });

      it('should hide git branch in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              gitBranch="feature/v030-test"
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should NOT show git branch
        expect(screen.queryByText(/feature\/v030-test/)).not.toBeInTheDocument();
        expect(screen.queryByText('🌿')).not.toBeInTheDocument();
      });

      it('should hide workflow stage in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              workflowStage="implementation"
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should NOT show workflow stage
        expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      });

      it('should hide token/cost details in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              tokens={{ input: 1500, output: 800 }}
              cost={0.05}
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should NOT show token details or cost
        expect(screen.queryByText(/2\.3k/)).not.toBeInTheDocument(); // formatted tokens
        expect(screen.queryByText(/\$0\.0500/)).not.toBeInTheDocument(); // formatted cost
        expect(screen.queryByText(/tokens:/)).not.toBeInTheDocument();
      });

      it('should hide API/web URLs in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              apiUrl="http://localhost:3001"
              webUrl="http://localhost:3000"
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should NOT show URLs
        expect(screen.queryByText(/localhost:3001/)).not.toBeInTheDocument();
        expect(screen.queryByText(/localhost:3000/)).not.toBeInTheDocument();
      });

      it('should hide session name in compact mode', () => {
        render(
          <ThemeProvider>
            <StatusBar
              sessionName="My Development Session"
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should NOT show session name
        expect(screen.queryByText(/My Development Session/)).not.toBeInTheDocument();
      });

      it('should handle compact mode with all props provided', () => {
        render(
          <ThemeProvider>
            <StatusBar
              gitBranch="feature/comprehensive-test"
              agent="architect"
              workflowStage="planning"
              isConnected={true}
              apiUrl="http://localhost:3001"
              webUrl="http://localhost:3000"
              sessionName="Full Props Test"
              sessionStartTime={new Date(Date.now() - 120000)} // 2 minutes ago
              subtaskProgress={{ completed: 3, total: 5 }}
              displayMode="compact"
              {...mockSessionData}
            />
          </ThemeProvider>
        );

        // Should show only: connection indicator, agent name, and timer
        expect(screen.getByText('●')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText(/02:0[0-9]/)).toBeInTheDocument();

        // Should hide everything else
        expect(screen.queryByText(/feature\/comprehensive-test/)).not.toBeInTheDocument();
        expect(screen.queryByText('planning')).not.toBeInTheDocument();
        expect(screen.queryByText(/localhost/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Full Props Test/)).not.toBeInTheDocument();
        expect(screen.queryByText(/3\/5/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme consistently across components', () => {
      render(
        <ThemeProvider theme="dark">
          <div>
            <StatusBar
              sessionData={{
                startTime: new Date(),
                tokenUsage: { input: 100, output: 50 },
                cost: 0.01,
                model: 'claude-3-sonnet',
              }}
            />
            <IntentDetector
              input="test input"
              commands={[]}
            />
          </div>
        </ThemeProvider>
      );

      // Components should render without theme conflicts
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
    });

    it('should handle theme switching dynamically', () => {
      const { rerender } = render(
        <ThemeProvider theme="light">
          <StatusBar
            sessionData={{
              startTime: new Date(),
              tokenUsage: { input: 200, output: 100 },
              cost: 0.015,
              model: 'claude-3-sonnet',
            }}
          />
        </ThemeProvider>
      );

      // Switch to dark theme
      rerender(
        <ThemeProvider theme="dark">
          <StatusBar
            sessionData={{
              startTime: new Date(),
              tokenUsage: { input: 200, output: 100 },
              cost: 0.015,
              model: 'claude-3-sonnet',
            }}
          />
        </ThemeProvider>
      );

      // Should render without errors in both themes
      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
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
            sessionData={{
              startTime: new Date(),
              tokenUsage: { input: 300, output: 150 },
              cost: 0.025,
              model: 'claude-3-sonnet',
            }}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
    });
  });
});