/**
 * End-to-End Natural Language Interface Workflow Tests
 * Tests the complete natural language interface workflow from user input to task execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../services/ConversationManager';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { IntentDetector, SmartSuggestions } from '../ui/components/IntentDetector';

// Mock external dependencies
vi.mock('fuse.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockReturnValue([
      { item: { name: 'run', description: 'Execute task' }, score: 0.1 }
    ])
  }))
}));

interface WorkflowStep {
  userInput: string;
  expectedIntentType: 'command' | 'task' | 'question' | 'clarification';
  expectedConfidenceMin: number;
  expectedSuggestions?: string[];
  clarificationResponse?: string;
  expectedClarificationType?: 'confirm' | 'choice' | 'freeform';
}

describe('Natural Language Interface E2E Workflow', () => {
  let conversationManager: ConversationManager;

  const mockCommands = [
    { name: 'run', aliases: ['execute'], description: 'Execute a task' },
    { name: 'status', aliases: ['st'], description: 'Show status' },
    { name: 'help', aliases: ['h'], description: 'Show help' },
    { name: 'logs', aliases: ['log'], description: 'Show logs' },
  ];

  beforeEach(() => {
    conversationManager = new ConversationManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Complete Task Creation Workflow', () => {
    it('should handle full task creation from natural language to execution', async () => {
      const workflow: WorkflowStep[] = [
        {
          userInput: 'I need to create a new authentication system',
          expectedIntentType: 'task',
          expectedConfidenceMin: 0.7,
          expectedSuggestions: ['Use specific action words', 'Be more specific']
        },
        {
          userInput: 'What authentication methods are supported?',
          expectedIntentType: 'question',
          expectedConfidenceMin: 0.8,
          expectedSuggestions: ['/help', '/status']
        },
        {
          userInput: 'Create a JWT-based authentication system with password hashing',
          expectedIntentType: 'task',
          expectedConfidenceMin: 0.7
        }
      ];

      for (const step of workflow) {
        // Add user message to conversation
        conversationManager.addMessage({
          role: 'user',
          content: step.userInput
        });

        // Detect intent
        const intent = conversationManager.detectIntent(step.userInput);

        // Validate intent
        expect(intent.type).toBe(step.expectedIntentType);
        expect(intent.confidence).toBeGreaterThanOrEqual(step.expectedConfidenceMin);

        // Add assistant response
        conversationManager.addMessage({
          role: 'assistant',
          content: `Processing ${step.expectedIntentType}: ${step.userInput}`
        });

        // Check suggestions if expected
        if (step.expectedSuggestions) {
          const suggestions = conversationManager.getSuggestions();
          const hasExpectedSuggestions = step.expectedSuggestions.some(expected =>
            suggestions.some(actual => actual.includes(expected))
          );
          expect(hasExpectedSuggestions).toBe(true);
        }
      }

      // Verify conversation context
      const context = conversationManager.getContext();
      expect(context.messages.length).toBe(workflow.length * 2); // User + assistant messages

      // Verify conversation summary
      const summary = conversationManager.summarizeContext();
      expect(summary).toContain('authentication');
    });

    it('should handle clarification flow in natural language workflow', async () => {
      // Initial ambiguous request
      conversationManager.addMessage({
        role: 'user',
        content: 'Fix the authentication problem'
      });

      const intent = conversationManager.detectIntent('Fix the authentication problem');
      expect(intent.type).toBe('task');

      // Simulate system requesting clarification
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Which authentication issue do you want to fix?',
        options: [
          'Login form validation',
          'JWT token expiration',
          'Password hashing algorithm',
          'Session management'
        ]
      });

      expect(conversationManager.hasPendingClarification()).toBe(true);

      // User provides clarification
      const clarificationResult = conversationManager.provideClarification('JWT token expiration');
      expect(clarificationResult.matched).toBe(true);
      expect(clarificationResult.value).toBe('JWT token expiration');

      // Continue workflow with clarified intent
      conversationManager.addMessage({
        role: 'user',
        content: 'Update the JWT expiration time to 24 hours'
      });

      const refinedIntent = conversationManager.detectIntent('Update the JWT expiration time to 24 hours');
      expect(refinedIntent.type).toBe('task');
      expect(refinedIntent.metadata?.suggestedWorkflow).toBe('feature');
    });

    it('should maintain context across multi-turn conversations', async () => {
      const conversationFlow = [
        { role: 'user', content: 'I want to improve the authentication system' },
        { role: 'assistant', content: 'I can help improve authentication. What specific aspect needs work?' },
        { role: 'user', content: 'The login is too slow' },
        { role: 'assistant', content: 'I\'ll optimize the login performance. Checking current implementation...' },
        { role: 'user', content: 'Also add remember me functionality' },
        { role: 'assistant', content: 'Adding remember me feature to the login optimization task.' }
      ];

      conversationFlow.forEach(message => {
        conversationManager.addMessage(message);
      });

      // Test context awareness
      const currentContext = conversationManager.getContext();
      expect(currentContext.messages.length).toBe(6);

      // Test that recent context influences intent detection
      const intent = conversationManager.detectIntent('Test it thoroughly');
      expect(intent.type).toBe('task');

      // Test context summarization
      const summary = conversationManager.summarizeContext();
      expect(summary).toContain('authentication');
      expect(summary).toContain('login');
    });
  });

  describe('Error Handling and Recovery Workflow', () => {
    it('should handle error scenarios gracefully in natural language flow', async () => {
      // Simulate error scenario
      conversationManager.addMessage({
        role: 'user',
        content: 'Deploy the authentication changes to production'
      });

      conversationManager.addMessage({
        role: 'assistant',
        content: 'Deployment failed: Authentication tests are failing'
      });

      // Check error-aware suggestions
      const suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('retry the task');
      expect(suggestions).toContain('fix the error');
      expect(suggestions).toContain('show me the logs');

      // User responds to error
      conversationManager.addMessage({
        role: 'user',
        content: 'Show me the failing tests'
      });

      const intent = conversationManager.detectIntent('Show me the failing tests');
      expect(intent.type).toBe('question');

      // Recovery action
      conversationManager.addMessage({
        role: 'user',
        content: 'Fix the JWT validation in the tests'
      });

      const fixIntent = conversationManager.detectIntent('Fix the JWT validation in the tests');
      expect(fixIntent.type).toBe('task');
      expect(fixIntent.metadata?.suggestedWorkflow).toBe('bugfix');
    });

    it('should handle invalid input gracefully', async () => {
      const invalidInputs = [
        '',
        '   ',
        'ñönäscii çhãràçtërs',
        'very long input'.repeat(100),
        '!!!@@@###$$$%%%',
        '🚀🎉💻🔥⚡'
      ];

      invalidInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toBeDefined();
        expect(['command', 'task', 'question', 'clarification']).toContain(intent.type);
        expect(intent.confidence).toBeGreaterThanOrEqual(0);
        expect(intent.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should recover from partial clarification flows', async () => {
      // Start clarification
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Choose deployment environment:',
        options: ['development', 'staging', 'production']
      });

      expect(conversationManager.hasPendingClarification()).toBe(true);

      // User provides unrelated input instead of answering
      conversationManager.addMessage({
        role: 'user',
        content: 'Actually, let me check something else first'
      });

      // System should handle gracefully
      const intent = conversationManager.detectIntent('Actually, let me check something else first');
      expect(intent.type).toBe('clarification'); // Still in clarification mode

      // User can cancel clarification by providing explicit new task
      conversationManager.addMessage({
        role: 'user',
        content: '/status'
      });

      const cancelIntent = conversationManager.detectIntent('/status');
      expect(cancelIntent.type).toBe('command');
    });
  });

  describe('UI Integration Workflow', () => {
    it('should integrate intent detection with UI components seamlessly', async () => {
      let detectedIntents: any[] = [];
      const mockOnIntent = vi.fn().mockImplementation((intent) => {
        detectedIntents.push(intent);
      });

      const { rerender } = render(
        <IntentDetector
          input=""
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
          showSuggestions={true}
        />
      );

      // Simulate typing progression
      const typingSequence = [
        'c',
        'cr',
        'cre',
        'crea',
        'create',
        'create a',
        'create a new',
        'create a new auth',
        'create a new authentication system'
      ];

      for (const input of typingSequence) {
        rerender(
          <IntentDetector
            input={input}
            commands={mockCommands}
            onIntentDetected={mockOnIntent}
            showSuggestions={true}
          />
        );

        // Advance timers for debounce
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }

      // Complete final debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should have detected final intent
      await waitFor(() => {
        expect(detectedIntents.length).toBeGreaterThan(0);
        const finalIntent = detectedIntents[detectedIntents.length - 1];
        expect(finalIntent.type).toBe('task');
      });

      // UI should show task intent
      expect(screen.getByText(/Task Intent/i)).toBeInTheDocument();
    });

    it('should coordinate between intent detection and suggestions', () => {
      const projectContext = {
        activeTask: 'auth-system-123',
        currentDirectory: '/src/auth',
        recentFiles: ['auth.service.ts', 'login.component.tsx']
      };

      const history = [
        'create authentication system',
        'fix login validation',
        'update JWT configuration'
      ];

      // Render both components
      render(
        <div>
          <IntentDetector
            input="update authentication"
            commands={mockCommands}
            showSuggestions={true}
          />
          <SmartSuggestions
            input="update authentication"
            history={history}
            context={projectContext}
            maxSuggestions={5}
          />
        </div>
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Both should recognize task context
      expect(screen.getByText(/Task Intent/i)).toBeInTheDocument();
      expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();

      // Suggestions should include context-aware options
      expect(screen.getByText('/status auth-system-123')).toBeInTheDocument();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle complex workflows efficiently', async () => {
      const startTime = performance.now();

      // Simulate complex multi-turn conversation
      for (let i = 0; i < 50; i++) {
        conversationManager.addMessage({
          role: 'user',
          content: `Task ${i}: Create component for authentication feature ${i}`
        });

        const intent = conversationManager.detectIntent(`Task ${i}: Create component for authentication feature ${i}`);
        expect(intent.type).toBe('task');

        conversationManager.addMessage({
          role: 'assistant',
          content: `Completed task ${i}`
        });

        // Occasionally add clarifications
        if (i % 10 === 0) {
          conversationManager.requestClarification({
            type: 'confirm',
            question: `Confirm completion of task ${i}?`
          });

          const result = conversationManager.provideClarification('yes');
          expect(result.matched).toBe(true);
        }
      }

      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);

      // Context should be pruned automatically
      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100);

      // Should still work properly after pruning
      const intent = conversationManager.detectIntent('create final authentication component');
      expect(intent.type).toBe('task');

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should maintain performance with frequent intent detection calls', () => {
      const startTime = performance.now();

      // Rapid intent detection calls
      for (let i = 0; i < 1000; i++) {
        const intent = conversationManager.detectIntent(`create component ${i}`);
        expect(intent.type).toBe('task');
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Feature Completeness Validation', () => {
    it('should support all ADR-002 specified features', () => {
      // 1. Natural Language First Interface
      const naturalIntent = conversationManager.detectIntent('I want to build a user dashboard');
      expect(naturalIntent.type).toBe('task');
      expect(naturalIntent.confidence).toBeGreaterThan(0.5);

      // 2. Smart Intent Detection
      const commandIntent = conversationManager.detectIntent('/help authentication');
      expect(commandIntent.type).toBe('command');
      expect(commandIntent.confidence).toBe(1.0);

      const questionIntent = conversationManager.detectIntent('How do I configure JWT tokens?');
      expect(questionIntent.type).toBe('question');

      // 3. Conversational Context
      conversationManager.addMessage({ role: 'user', content: 'Create auth system' });
      conversationManager.addMessage({ role: 'assistant', content: 'Working on auth system' });

      const contextualIntent = conversationManager.detectIntent('Add password validation to it');
      expect(contextualIntent.type).toBe('task');

      // 4. Task Refinement
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Which validation type?',
        options: ['regex', 'library', 'custom']
      });

      const clarificationResult = conversationManager.provideClarification('library');
      expect(clarificationResult.matched).toBe(true);

      // 5. Contextual Suggestions
      const suggestions = conversationManager.getSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(Array.isArray(suggestions)).toBe(true);

      // Verify all features work together
      const context = conversationManager.getContext();
      expect(context.messages.length).toBeGreaterThan(0);

      const summary = conversationManager.summarizeContext();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });
  });
});