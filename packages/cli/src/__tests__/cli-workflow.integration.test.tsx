import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '../__tests__/test-utils';
import { AdvancedInput } from '../ui/components/AdvancedInput';
import { CompletionEngine } from '../services/CompletionEngine';
import { SessionStore } from '../services/SessionStore';
import { SessionAutoSaver } from '../services/SessionAutoSaver';
import { ShortcutManager } from '../services/ShortcutManager';
import { ConversationManager } from '../services/ConversationManager';

// Mock useInput from ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

// Mock file system operations
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe('CLI Workflow Integration Tests', () => {
  let completionEngine: CompletionEngine;
  let sessionStore: SessionStore;
  let sessionAutoSaver: SessionAutoSaver;
  let shortcutManager: ShortcutManager;
  let conversationManager: ConversationManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    completionEngine = new CompletionEngine();
    sessionStore = new SessionStore('/test/project');
    await sessionStore.initialize();
    sessionAutoSaver = new SessionAutoSaver(sessionStore);
    shortcutManager = new ShortcutManager();
    conversationManager = new ConversationManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Management Workflow', () => {
    it('creates and manages session lifecycle', async () => {
      // Start a new session
      const session = await sessionAutoSaver.start();

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_\d+_\w+$/);

      // Add messages to session
      await sessionAutoSaver.addMessage({
        role: 'user',
        content: 'Create a new feature for user authentication'
      });

      await sessionAutoSaver.addMessage({
        role: 'assistant',
        content: 'I will help you create user authentication. Let me start by analyzing your codebase.',
        agent: 'planner'
      });

      // Update session state
      await sessionAutoSaver.updateState({
        totalTokens: { input: 100, output: 200 },
        totalCost: 0.05,
        tasksCreated: ['task_123']
      });

      // Add input to history
      await sessionAutoSaver.addInputToHistory('/status');

      const currentSession = sessionAutoSaver.getSession();
      expect(currentSession?.messages).toHaveLength(2);
      expect(currentSession?.state.totalCost).toBe(0.05);
      expect(currentSession?.inputHistory).toContain('/status');

      // Save and stop
      await sessionAutoSaver.stop();
      expect(sessionAutoSaver.hasUnsavedChanges()).toBe(false);
    });

    it('handles session branching', async () => {
      // Create initial session with messages
      const session = await sessionStore.createSession('Main Session');

      await sessionStore.updateSession(session.id, {
        messages: [
          {
            id: 'msg-1',
            index: 0,
            role: 'user',
            content: 'First message',
            timestamp: new Date()
          },
          {
            id: 'msg-2',
            index: 1,
            role: 'assistant',
            content: 'First response',
            timestamp: new Date()
          },
          {
            id: 'msg-3',
            index: 2,
            role: 'user',
            content: 'Second message',
            timestamp: new Date()
          }
        ]
      });

      // Branch from message index 1
      const branchedSession = await sessionStore.branchSession(session.id, 1, 'Alternative Approach');

      expect(branchedSession.name).toBe('Alternative Approach');
      expect(branchedSession.parentSessionId).toBe(session.id);
      expect(branchedSession.branchPoint).toBe(1);
      expect(branchedSession.messages).toHaveLength(2); // Only first two messages

      // Original session should have reference to branched session
      const updatedSession = await sessionStore.getSession(session.id);
      expect(updatedSession?.childSessionIds).toContain(branchedSession.id);
    });

    it('exports sessions in different formats', async () => {
      const session = await sessionStore.createSession('Export Test');

      await sessionStore.updateSession(session.id, {
        messages: [
          {
            id: 'msg-1',
            index: 0,
            role: 'user',
            content: 'Test message',
            timestamp: new Date('2023-01-01T10:00:00Z')
          }
        ],
        state: {
          totalTokens: { input: 10, output: 20 },
          totalCost: 0.01,
          tasksCreated: ['task-1'],
          tasksCompleted: []
        }
      });

      // Test markdown export
      const markdownExport = await sessionStore.exportSession(session.id, 'md');
      expect(markdownExport).toContain('# APEX Session: Export Test');
      expect(markdownExport).toContain('**User**');
      expect(markdownExport).toContain('Test message');

      // Test JSON export
      const jsonExport = await sessionStore.exportSession(session.id, 'json');
      const parsedJson = JSON.parse(jsonExport);
      expect(parsedJson.name).toBe('Export Test');
      expect(parsedJson.messages).toHaveLength(1);

      // Test HTML export
      const htmlExport = await sessionStore.exportSession(session.id, 'html');
      expect(htmlExport).toContain('<!DOCTYPE html>');
      expect(htmlExport).toContain('<title>APEX Session: Export Test</title>');
    });
  });

  describe('Command Completion Workflow', () => {
    it('provides contextual completions', async () => {
      const context = {
        projectPath: '/test/project',
        agents: ['planner', 'developer', 'reviewer'],
        workflows: ['feature', 'bugfix'],
        recentTasks: [
          { id: 'task_123', description: 'Implement authentication' },
          { id: 'task_456', description: 'Fix payment bug' }
        ],
        inputHistory: [
          'create a new component',
          'fix the bug in authentication',
          '/status'
        ]
      };

      // Test command completion
      const commandCompletions = await completionEngine.getCompletions('/he', 3, context);
      expect(commandCompletions).toContainEqual(
        expect.objectContaining({
          value: '/help',
          type: 'command'
        })
      );

      // Test agent completion
      const agentCompletions = await completionEngine.getCompletions('@plan', 5, context);
      expect(agentCompletions).toContainEqual(
        expect.objectContaining({
          value: '@planner',
          type: 'agent'
        })
      );

      // Test workflow completion
      const workflowCompletions = await completionEngine.getCompletions('--workflow fea', 15, context);
      expect(workflowCompletions).toContainEqual(
        expect.objectContaining({
          value: 'feature',
          type: 'workflow'
        })
      );

      // Test task ID completion
      const taskCompletions = await completionEngine.getCompletions('retry task_1', 11, context);
      expect(taskCompletions).toContainEqual(
        expect.objectContaining({
          value: 'task_123',
          type: 'task'
        })
      );

      // Test history completion
      const historyCompletions = await completionEngine.getCompletions('create', 6, context);
      expect(historyCompletions).toContainEqual(
        expect.objectContaining({
          value: 'create a new component',
          type: 'history'
        })
      );
    });

    it('integrates completion with input component', async () => {
      const context = {
        projectPath: '/test/project',
        agents: ['planner'],
        workflows: ['feature'],
        recentTasks: [],
        inputHistory: []
      };

      const onSubmit = vi.fn();
      const suggestions = [
        { value: '/help', description: 'Show help', type: 'command' as const }
      ];

      const { rerender } = render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={context}
          suggestions={suggestions}
          onSubmit={onSubmit}
        />
      );

      // Test that completions are integrated properly
      expect(() => rerender(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={context}
          suggestions={suggestions}
          value="/he"
          onSubmit={onSubmit}
        />
      )).not.toThrow();
    });
  });

  describe('Shortcut Management Workflow', () => {
    it('handles keyboard shortcuts in different contexts', () => {
      const commandHandler = vi.fn();
      const eventHandler = vi.fn();

      shortcutManager.on('command', commandHandler);
      shortcutManager.on('custom-event', eventHandler);

      // Test global shortcuts
      expect(shortcutManager.getCurrentContext()).toBe('global');

      const helpShortcut = { key: 'h', ctrl: true, alt: false, shift: false, meta: false };
      expect(shortcutManager.handleKey(helpShortcut)).toBe(true);
      expect(commandHandler).toHaveBeenCalledWith('/help');

      // Test context switching
      shortcutManager.pushContext('input');
      expect(shortcutManager.getCurrentContext()).toBe('input');

      const clearShortcut = { key: 'l', ctrl: true, alt: false, shift: false, meta: false };
      expect(shortcutManager.handleKey(clearShortcut)).toBe(true);
      expect(eventHandler).toHaveBeenCalledWith(undefined);

      // Test context popping
      const poppedContext = shortcutManager.popContext();
      expect(poppedContext).toBe('input');
      expect(shortcutManager.getCurrentContext()).toBe('global');
    });

    it('formats shortcuts for display', () => {
      const testCases = [
        { keys: { key: 'h', ctrl: true }, expected: 'Ctrl+H' },
        { keys: { key: 's', ctrl: true, shift: true }, expected: 'Ctrl+Shift+S' },
        { keys: { key: 'a', ctrl: true, alt: true, shift: true, meta: true }, expected: 'Ctrl+Alt+Shift+Cmd+A' }
      ];

      for (const testCase of testCases) {
        expect(shortcutManager.formatKey(testCase.keys)).toBe(testCase.expected);
      }
    });

    it('manages context-specific shortcuts', () => {
      shortcutManager.register({
        id: 'input-only',
        description: 'Input only shortcut',
        keys: { key: 'i', ctrl: true },
        action: { type: 'emit', event: 'input-action' },
        context: 'input'
      });

      const inputHandler = vi.fn();
      shortcutManager.on('input-action', inputHandler);

      const shortcutEvent = { key: 'i', ctrl: true, alt: false, shift: false, meta: false };

      // Should not work in global context
      expect(shortcutManager.handleKey(shortcutEvent)).toBe(false);
      expect(inputHandler).not.toHaveBeenCalled();

      // Should work in input context
      shortcutManager.pushContext('input');
      expect(shortcutManager.handleKey(shortcutEvent)).toBe(true);
      expect(inputHandler).toHaveBeenCalled();
    });
  });

  describe('Conversation Management Workflow', () => {
    it('manages conversation flow with clarifications', () => {
      // Add initial messages
      conversationManager.addMessage({
        role: 'user',
        content: 'Create a new API endpoint'
      });

      conversationManager.addMessage({
        role: 'assistant',
        content: 'I can help you create an API endpoint. What type of endpoint do you need?'
      });

      // Request clarification
      conversationManager.requestClarification({
        type: 'choice',
        question: 'What type of API endpoint?',
        options: ['REST', 'GraphQL', 'WebSocket']
      });

      expect(conversationManager.hasPendingClarification()).toBe(true);

      // Provide clarification response
      const clarificationResult = conversationManager.provideClarification('REST');
      expect(clarificationResult.matched).toBe(true);
      expect(clarificationResult.value).toBe('REST');
      expect(clarificationResult.index).toBe(0);

      expect(conversationManager.hasPendingClarification()).toBe(false);

      // Check messages were added
      const context = conversationManager.getContext();
      expect(context.messages).toHaveLength(4); // 2 original + 1 system clarification + 1 user response
    });

    it('detects intent correctly', () => {
      const testCases = [
        { input: '/help', expectedType: 'command', expectedConfidence: 1.0 },
        { input: 'What is the status?', expectedType: 'question', expectedConfidence: 0.8 },
        { input: 'Create a new component', expectedType: 'task', expectedConfidence: 0.7 },
        { input: 'Fix the bug', expectedType: 'task', expectedConfidence: 0.7 },
        { input: 'random text', expectedType: 'task', expectedConfidence: 0.5 }
      ];

      for (const testCase of testCases) {
        const intent = conversationManager.detectIntent(testCase.input);
        expect(intent.type).toBe(testCase.expectedType);
        expect(intent.confidence).toBe(testCase.expectedConfidence);
      }
    });

    it('provides contextual suggestions', () => {
      // Test error context suggestions
      conversationManager.addMessage({
        role: 'assistant',
        content: 'The deployment failed with an error in the configuration.'
      });

      const errorSuggestions = conversationManager.getSuggestions();
      expect(errorSuggestions).toContain('retry the task');
      expect(errorSuggestions).toContain('fix the error');

      // Clear and test completion context
      conversationManager.clearContext();
      conversationManager.addMessage({
        role: 'assistant',
        content: 'The feature has been completed successfully.'
      });

      const completionSuggestions = conversationManager.getSuggestions();
      expect(completionSuggestions).toContain('show me the changes');
      expect(completionSuggestions).toContain('test the implementation');
    });

    it('manages task context', () => {
      conversationManager.setTask('task-123');
      conversationManager.setAgent('developer');
      conversationManager.setWorkflowStage('implementation');

      const context = conversationManager.getContext();
      expect(context.currentTaskId).toBe('task-123');
      expect(context.activeAgent).toBe('developer');
      expect(context.workflowStage).toBe('implementation');

      // Test task-aware suggestions
      const suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('/status');
      expect(suggestions).toContain('/logs');
      expect(suggestions).toContain('cancel the task');

      // Clear task context
      conversationManager.clearTask();
      conversationManager.clearAgent();

      const clearedContext = conversationManager.getContext();
      expect(clearedContext.currentTaskId).toBeUndefined();
      expect(clearedContext.activeAgent).toBeUndefined();
    });
  });

  describe('End-to-End CLI Workflow', () => {
    it('simulates complete user interaction flow', async () => {
      // Start new session
      const session = await sessionAutoSaver.start();
      conversationManager.setTask(session.id);

      // User types command with completion
      const context = {
        projectPath: '/test/project',
        agents: ['planner', 'developer'],
        workflows: ['feature'],
        recentTasks: [],
        inputHistory: []
      };

      const completions = await completionEngine.getCompletions('/stat', 5, context);
      expect(completions.some(c => c.value === '/status')).toBe(true);

      // User triggers shortcut
      const statusHandler = vi.fn();
      shortcutManager.on('command', statusHandler);
      const statusShortcut = { key: 's', ctrl: true, shift: true, alt: false, meta: false };
      shortcutManager.handleKey(statusShortcut);
      expect(statusHandler).toHaveBeenCalledWith('/status');

      // Add user input and response
      await sessionAutoSaver.addMessage({
        role: 'user',
        content: '/status'
      });

      conversationManager.addMessage({
        role: 'user',
        content: '/status'
      });

      const intent = conversationManager.detectIntent('/status');
      expect(intent.type).toBe('command');

      await sessionAutoSaver.addMessage({
        role: 'assistant',
        content: 'Current status: No active tasks'
      });

      conversationManager.addMessage({
        role: 'assistant',
        content: 'Current status: No active tasks'
      });

      // Request clarification
      conversationManager.requestClarification({
        type: 'confirm',
        question: 'Would you like to create a new task?'
      });

      const clarificationSuggestions = conversationManager.getSuggestions();
      expect(clarificationSuggestions).toContain('yes');
      expect(clarificationSuggestions).toContain('no');

      // User provides clarification
      const clarificationResult = conversationManager.provideClarification('yes');
      expect(clarificationResult.matched).toBe(true);
      expect(clarificationResult.value).toBe(true);

      // Update session state
      await sessionAutoSaver.updateState({
        totalTokens: { input: 50, output: 100 },
        totalCost: 0.02
      });

      await sessionAutoSaver.addInputToHistory('/status');

      // Verify final state
      const finalSession = sessionAutoSaver.getSession();
      expect(finalSession?.messages.length).toBeGreaterThan(0);
      expect(finalSession?.state.totalCost).toBe(0.02);
      expect(finalSession?.inputHistory).toContain('/status');

      const conversationContext = conversationManager.getContext();
      expect(conversationContext.messages.length).toBeGreaterThan(2);

      // Save session
      await sessionAutoSaver.stop();
    });

    it('handles error scenarios gracefully', async () => {
      // Test session creation failure
      const mockStore = {
        createSession: vi.fn().mockRejectedValue(new Error('Storage error')),
        getSession: vi.fn(),
        updateSession: vi.fn(),
      } as any;

      const errorAutoSaver = new SessionAutoSaver(mockStore);

      await expect(errorAutoSaver.start()).rejects.toThrow('Storage error');

      // Test completion engine errors
      const context = {
        projectPath: '/test/project',
        agents: [],
        workflows: [],
        recentTasks: [],
        inputHistory: []
      };

      // Should handle gracefully when completion fails
      const completions = await completionEngine.getCompletions('test', 4, context);
      expect(Array.isArray(completions)).toBe(true);

      // Test shortcut handling with invalid shortcuts
      const invalidShortcut = { key: '', ctrl: false, alt: false, shift: false, meta: false };
      expect(shortcutManager.handleKey(invalidShortcut)).toBe(false);

      // Test conversation manager with edge cases
      const invalidClarification = conversationManager.provideClarification('response');
      expect(invalidClarification.matched).toBe(false);
    });
  });
});