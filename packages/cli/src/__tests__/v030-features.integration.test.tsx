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
  });
});