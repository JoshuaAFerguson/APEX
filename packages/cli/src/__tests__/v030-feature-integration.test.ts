import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../services/SessionStore';
import { SessionAutoSaver } from '../services/SessionAutoSaver';
import { ConversationManager } from '../services/ConversationManager';
import { CompletionEngine } from '../services/CompletionEngine';
import { ShortcutManager } from '../services/ShortcutManager';

/**
 * V0.3.0 Feature Integration Tests
 * Tests the integration between core services and components
 */

describe('V0.3.0 Feature Integration Tests', () => {
  let sessionStore: SessionStore;
  let autoSaver: SessionAutoSaver;
  let conversationManager: ConversationManager;
  let completionEngine: CompletionEngine;
  let shortcutManager: ShortcutManager;

  beforeEach(() => {
    // Mock file system operations for tests
    vi.spyOn(require('fs/promises'), 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('{}');
    vi.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

    sessionStore = new SessionStore('/test/project');
    autoSaver = new SessionAutoSaver(sessionStore);
    conversationManager = new ConversationManager();
    completionEngine = new CompletionEngine();
    shortcutManager = new ShortcutManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Management Integration', () => {
    it('should integrate SessionStore with SessionAutoSaver for automatic persistence', async () => {
      // Create a session
      const session = await sessionStore.createSession();

      // Add messages to the session
      sessionStore.addMessage(session.id, {
        role: 'user',
        content: 'Test message',
        agent: 'developer',
        stage: 'implementation'
      });

      // Start auto-saving
      autoSaver.startAutoSave(session.id);

      // Wait for auto-save interval
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify auto-save was attempted
      expect(require('fs/promises').writeFile).toHaveBeenCalled();

      autoSaver.stopAutoSave();
    });

    it('should handle session state persistence across service interactions', async () => {
      const session = await sessionStore.createSession();

      // Simulate conversation flow
      conversationManager.setTask('test-task-123');
      conversationManager.setAgent('developer');
      conversationManager.setWorkflowStage('implementation');

      // Add conversation to session
      sessionStore.addMessage(session.id, {
        role: 'user',
        content: 'Implement user authentication'
      });

      const context = conversationManager.getContext();
      sessionStore.addMessage(session.id, {
        role: 'assistant',
        content: `Starting ${context.workflowStage} stage with ${context.activeAgent}`,
        agent: context.activeAgent,
        stage: context.workflowStage,
        taskId: context.currentTaskId
      });

      // Update session state
      sessionStore.updateState(session.id, {
        totalTokens: { input: 100, output: 150 },
        totalCost: 0.05,
        tasksCreated: ['test-task-123'],
        tasksCompleted: [],
        currentTaskId: 'test-task-123'
      });

      // Retrieve and verify session
      const retrievedSession = await sessionStore.getSession(session.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.messages).toHaveLength(2);
      expect(retrievedSession?.state.currentTaskId).toBe('test-task-123');
      expect(retrievedSession?.state.totalCost).toBe(0.05);
    });

    it('should handle branching workflows with proper session management', async () => {
      const parentSession = await sessionStore.createSession();

      // Create conversation in parent session
      conversationManager.setTask('main-task');
      conversationManager.addMessage({
        role: 'user',
        content: 'Create a feature with authentication and testing'
      });

      sessionStore.addMessage(parentSession.id, {
        role: 'user',
        content: 'Create a feature with authentication and testing'
      });

      // Branch for authentication subtask
      const authSession = await sessionStore.createSession({
        name: 'Authentication Implementation',
        parentSessionId: parentSession.id
      });

      // Branch for testing subtask
      const testSession = await sessionStore.createSession({
        name: 'Testing Implementation',
        parentSessionId: parentSession.id
      });

      // Verify branching structure
      expect(authSession.parentSessionId).toBe(parentSession.id);
      expect(testSession.parentSessionId).toBe(parentSession.id);

      // Test session retrieval with branching
      const sessions = await sessionStore.getAllSessions();
      const parentSessionData = sessions.find(s => s.id === parentSession.id);
      expect(parentSessionData).toBeDefined();
    });
  });

  describe('Conversation Flow Integration', () => {
    it('should integrate ConversationManager with CompletionEngine for contextual suggestions', async () => {
      // Set up conversation context
      conversationManager.addMessage({
        role: 'user',
        content: 'I need to implement user authentication'
      });

      conversationManager.setTask('auth-task');
      conversationManager.setAgent('developer');

      // Get suggestions based on conversation context
      const context = {
        projectPath: '/test/project',
        agents: ['developer', 'tester'],
        workflows: ['feature-implementation'],
        recentTasks: [{ id: 'auth-task', description: 'Implement authentication' }],
        inputHistory: ['implement auth', 'add login form']
      };

      const suggestions = await completionEngine.getSuggestions(
        'add password',
        11, // cursor position after 'add password'
        context
      );

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle clarification workflows through conversation management', () => {
      // Start a workflow requiring clarification
      conversationManager.addMessage({
        role: 'assistant',
        content: 'I can implement authentication in several ways.'
      });

      conversationManager.requestClarification({
        question: 'Which authentication method would you prefer?',
        type: 'choice',
        options: ['JWT', 'Session-based', 'OAuth']
      });

      const context = conversationManager.getContext();
      expect(context.pendingClarification).toBeDefined();
      expect(context.pendingClarification?.type).toBe('choice');

      // Provide clarification
      const result = conversationManager.provideClarification('JWT');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('JWT');

      // Verify clarification is cleared
      const updatedContext = conversationManager.getContext();
      expect(updatedContext.pendingClarification).toBeUndefined();
    });

    it('should maintain conversation context across agent handoffs', () => {
      // Start with developer agent
      conversationManager.setAgent('developer');
      conversationManager.setWorkflowStage('implementation');
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Implementation completed, handing off to tester.'
      });

      const implementationContext = conversationManager.getContext();
      expect(implementationContext.activeAgent).toBe('developer');
      expect(implementationContext.workflowStage).toBe('implementation');

      // Handoff to tester
      conversationManager.setAgent('tester');
      conversationManager.setWorkflowStage('testing');
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Starting test suite execution.'
      });

      const testingContext = conversationManager.getContext();
      expect(testingContext.activeAgent).toBe('tester');
      expect(testingContext.workflowStage).toBe('testing');

      // Verify conversation history is maintained
      const messages = conversationManager.getRecentMessages(10);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toContain('Implementation completed');
      expect(messages[1].content).toContain('Starting test suite');
    });
  });

  describe('Command and Shortcut Integration', () => {
    it('should integrate ShortcutManager with CompletionEngine for command suggestions', async () => {
      // Register shortcuts
      shortcutManager.registerShortcut({
        key: 'impl',
        expansion: 'implement user authentication feature',
        description: 'Quick auth implementation'
      });

      shortcutManager.registerShortcut({
        key: 'test',
        expansion: 'create comprehensive test suite for',
        description: 'Test suite creation'
      });

      // Test shortcut expansion
      const expandedImpl = shortcutManager.expandShortcuts('impl with JWT');
      expect(expandedImpl).toBe('implement user authentication feature with JWT');

      const expandedTest = shortcutManager.expandShortcuts('test authentication');
      expect(expandedTest).toBe('create comprehensive test suite for authentication');

      // Verify shortcuts are available for completion
      const shortcuts = shortcutManager.getShortcuts();
      expect(shortcuts).toHaveLength(2);
      expect(shortcuts.map(s => s.key)).toContain('impl');
      expect(shortcuts.map(s => s.key)).toContain('test');
    });

    it('should handle command completion with file path integration', async () => {
      // Mock file system for path completion
      vi.spyOn(require('fs/promises'), 'readdir').mockResolvedValue([
        { name: 'src', isDirectory: () => true },
        { name: 'package.json', isDirectory: () => false },
        { name: 'README.md', isDirectory: () => false }
      ]);

      const context = {
        projectPath: '/test/project',
        agents: ['developer'],
        workflows: ['feature'],
        recentTasks: [],
        inputHistory: []
      };

      // Test file path completion
      const suggestions = await completionEngine.getSuggestions(
        'edit src/',
        8, // cursor at end
        context
      );

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service failures gracefully across integration points', async () => {
      // Simulate SessionStore failure
      vi.spyOn(require('fs/promises'), 'writeFile').mockRejectedValue(new Error('Disk full'));

      const session = await sessionStore.createSession();

      // Start auto-saver (should handle write failures)
      autoSaver.startAutoSave(session.id);

      // Add message (should succeed despite save failure)
      expect(() => {
        sessionStore.addMessage(session.id, {
          role: 'user',
          content: 'Test message'
        });
      }).not.toThrow();

      autoSaver.stopAutoSave();
    });

    it('should maintain conversation state during service errors', () => {
      // Start conversation
      conversationManager.addMessage({
        role: 'user',
        content: 'Start task'
      });

      conversationManager.setTask('error-test');

      // Simulate error in conversation flow
      expect(() => {
        conversationManager.requestClarification({
          question: 'Continue despite error?',
          type: 'confirm'
        });
      }).not.toThrow();

      // Verify conversation state is maintained
      const context = conversationManager.getContext();
      expect(context.currentTaskId).toBe('error-test');
      expect(context.pendingClarification).toBeDefined();
    });

    it('should handle completion engine failures without breaking input flow', async () => {
      // Mock completion failure
      const mockGetSuggestions = vi.fn().mockRejectedValue(new Error('Completion service unavailable'));
      completionEngine.getSuggestions = mockGetSuggestions;

      const context = {
        projectPath: '/test/project',
        agents: [],
        workflows: [],
        recentTasks: [],
        inputHistory: []
      };

      // Should handle failure gracefully
      try {
        await completionEngine.getSuggestions('test input', 10, context);
      } catch (error) {
        expect(error.message).toBe('Completion service unavailable');
      }

      // Verify error doesn't break other services
      expect(() => {
        conversationManager.addMessage({
          role: 'user',
          content: 'Message after completion error'
        });
      }).not.toThrow();
    });
  });

  describe('Performance Integration', () => {
    it('should handle high-frequency message additions with auto-saving', async () => {
      const session = await sessionStore.createSession();
      autoSaver.startAutoSave(session.id, { intervalMs: 500 }); // Fast interval for testing

      // Add messages rapidly
      for (let i = 0; i < 50; i++) {
        sessionStore.addMessage(session.id, {
          role: 'user',
          content: `Rapid message ${i}`
        });

        // Add to conversation manager too
        conversationManager.addMessage({
          role: 'user',
          content: `Conversation message ${i}`
        });
      }

      // Verify session has all messages
      const retrievedSession = await sessionStore.getSession(session.id);
      expect(retrievedSession?.messages).toHaveLength(50);

      // Verify conversation manager pruning works
      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100); // Should respect max limit

      autoSaver.stopAutoSave();
    });

    it('should handle memory cleanup during long-running sessions', async () => {
      const session = await sessionStore.createSession();

      // Simulate long-running session with many interactions
      for (let i = 0; i < 200; i++) {
        // Add messages
        sessionStore.addMessage(session.id, {
          role: 'user',
          content: `Long session message ${i}`
        });

        conversationManager.addMessage({
          role: 'assistant',
          content: `Response to message ${i}`
        });

        // Periodically update state
        if (i % 10 === 0) {
          sessionStore.updateState(session.id, {
            totalTokens: { input: i * 10, output: i * 15 },
            totalCost: i * 0.001,
            tasksCreated: [`task-${i}`],
            tasksCompleted: i > 0 ? [`task-${i-1}`] : [],
            currentTaskId: `task-${i}`
          });
        }
      }

      // Verify services are still responsive
      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100);

      const retrievedSession = await sessionStore.getSession(session.id);
      expect(retrievedSession?.messages).toHaveLength(200);
      expect(retrievedSession?.state.totalCost).toBeGreaterThan(0);
    });
  });
});