/**
 * Comprehensive Natural Language Interface Integration Tests
 * Tests the complete natural language workflow as specified in ADR-002
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../ConversationManager';

describe('Natural Language Interface - ADR-002 Comprehensive Tests', () => {
  let conversationManager: ConversationManager;

  beforeEach(() => {
    conversationManager = new ConversationManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Natural Language First Approach', () => {
    it('should prioritize natural language over commands for descriptive input', () => {
      const naturalInputs = [
        'I need to create a new React component for user authentication',
        'Please fix the bug in the payment processing system',
        'Can you help me refactor the database connection code?',
        'Update the documentation to include the new API endpoints',
        'Remove the deprecated functions from the utils module'
      ];

      naturalInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBeGreaterThan(0.5);
        expect(intent.metadata?.suggestedWorkflow).toBeDefined();
      });
    });

    it('should detect workflow types from natural language patterns', () => {
      const workflowTests = [
        { input: 'Fix the broken authentication bug', expectedWorkflow: 'bugfix' },
        { input: 'There is an error in the payment system', expectedWorkflow: 'bugfix' },
        { input: 'The login is crashing', expectedWorkflow: 'bugfix' },
        { input: 'Create a new user dashboard', expectedWorkflow: 'feature' },
        { input: 'Add support for dark mode', expectedWorkflow: 'feature' },
        { input: 'Build a notification system', expectedWorkflow: 'feature' }
      ];

      workflowTests.forEach(({ input, expectedWorkflow }) => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.metadata?.suggestedWorkflow).toBe(expectedWorkflow);
      });
    });

    it('should handle conversational patterns', () => {
      const conversationalInputs = [
        'I want to create a new component',
        'I need help with fixing this bug',
        'Could you please update the tests?',
        'Would you be able to refactor this code?',
        'Can you show me how to deploy this?'
      ];

      conversationalInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(['task', 'question']).toContain(intent.type);
        expect(intent.confidence).toBeGreaterThan(0.5);
      });
    });
  });

  describe('Multi-turn Conversation Context', () => {
    it('should maintain context across multiple interactions', () => {
      // Initial task
      conversationManager.addMessage({
        role: 'user',
        content: 'Create a new authentication component'
      });
      conversationManager.addMessage({
        role: 'assistant',
        content: 'I\'ll help you create an authentication component. What type of authentication do you need?'
      });

      // Follow-up with context
      conversationManager.addMessage({
        role: 'user',
        content: 'Make it use JWT tokens'
      });

      const context = conversationManager.getContext();
      expect(context.messages).toHaveLength(3);

      const summary = conversationManager.summarizeContext();
      expect(summary).toContain('authentication');
    });

    it('should generate context-aware suggestions', () => {
      // Set up task context
      conversationManager.setTask('auth-task-123');
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Authentication component has been created successfully'
      });

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('show me the changes');
      expect(suggestions).toContain('/status');
      expect(suggestions).toContain('/logs');
    });

    it('should handle context pruning gracefully', () => {
      // Add many messages to trigger pruning
      for (let i = 0; i < 110; i++) {
        conversationManager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i} about authentication component development`
        });
      }

      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100);

      // Should still work after pruning
      const intent = conversationManager.detectIntent('test the authentication');
      expect(intent.type).toBe('task');
    });
  });

  describe('Task Refinement Through Questions', () => {
    it('should detect ambiguous references and request clarification', () => {
      conversationManager.addMessage({
        role: 'user',
        content: 'Fix the file'
      });

      // Simulate ambiguity detection (would be done by the app layer)
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Which file do you want to fix?',
        options: ['auth.ts', 'utils.ts', 'config.ts']
      });

      expect(conversationManager.hasPendingClarification()).toBe(true);

      // Test clarification response
      const result = conversationManager.provideClarification('auth.ts');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('auth.ts');
      expect(conversationManager.hasPendingClarification()).toBe(false);
    });

    it('should handle confirmation dialogs', () => {
      conversationManager.requestClarification({
        type: 'confirm',
        question: 'This will delete the old authentication system. Do you want to proceed?'
      });

      expect(conversationManager.hasPendingClarification()).toBe(true);

      const confirmResult = conversationManager.provideClarification('yes');
      expect(confirmResult.matched).toBe(true);
      expect(confirmResult.value).toBe(true);
    });

    it('should handle freeform input requests', () => {
      conversationManager.requestClarification({
        type: 'freeform',
        question: 'Please provide the API endpoint URL for the authentication service:'
      });

      const result = conversationManager.provideClarification('https://api.example.com/auth');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('https://api.example.com/auth');
    });
  });

  describe('Intent Classification Robustness', () => {
    it('should handle mixed intent patterns correctly', () => {
      const mixedIntents = [
        { input: 'How do I create a component?', expectedType: 'question' },
        { input: 'Create a component that handles authentication', expectedType: 'task' },
        { input: 'What is the status of the auth task?', expectedType: 'question' },
        { input: '/status auth-task', expectedType: 'command' },
        { input: 'Help me understand the authentication flow', expectedType: 'question' },
        { input: 'Configure the JWT secret key', expectedType: 'task' }
      ];

      mixedIntents.forEach(({ input, expectedType }) => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe(expectedType);
      });
    });

    it('should provide appropriate confidence scores', () => {
      const confidenceTests = [
        { input: '/help', expectedMinConfidence: 1.0 },
        { input: 'create a component', expectedMinConfidence: 0.7 },
        { input: 'what is this?', expectedMinConfidence: 0.8 },
        { input: 'some random text', expectedMinConfidence: 0.5 }
      ];

      confidenceTests.forEach(({ input, expectedMinConfidence }) => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.confidence).toBeGreaterThanOrEqual(expectedMinConfidence);
      });
    });

    it('should maintain metadata consistency', () => {
      const input = 'create a new user management feature';
      const intent = conversationManager.detectIntent(input);

      expect(intent.metadata).toBeDefined();
      expect(intent.metadata?.matchedPattern).toBeDefined();
      expect(intent.metadata?.suggestedWorkflow).toBeDefined();
      expect(intent.metadata?.estimatedComplexity).toBeDefined();
    });
  });

  describe('Smart Suggestions System', () => {
    it('should provide error-recovery suggestions', () => {
      conversationManager.addMessage({
        role: 'assistant',
        content: 'The authentication test failed due to missing JWT secret'
      });

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('retry the task');
      expect(suggestions).toContain('fix the error');
      expect(suggestions).toContain('show me the logs');
      expect(suggestions).toContain('try a different approach');
    });

    it('should provide completion suggestions', () => {
      conversationManager.addMessage({
        role: 'assistant',
        content: 'The authentication component has been completed successfully'
      });

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('show me the changes');
      expect(suggestions).toContain('test the implementation');
      expect(suggestions).toContain('create a pull request');
      expect(suggestions).toContain('deploy the changes');
    });

    it('should provide task-specific suggestions', () => {
      conversationManager.setTask('auth-component-123');

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions).toContain('/status');
      expect(suggestions).toContain('/logs');
      expect(suggestions).toContain('cancel the task');
      expect(suggestions).toContain('modify the requirements');
    });

    it('should limit suggestions appropriately', () => {
      // Create a complex context with many potential suggestions
      conversationManager.setTask('complex-task');
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Task completed with some errors'
      });

      const suggestions = conversationManager.getSuggestions();
      expect(suggestions.length).toBeLessThanOrEqual(8);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle rapid intent classification requests', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const intent = conversationManager.detectIntent(`create component ${i}`);
        expect(intent.type).toBe('task');
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should manage memory efficiently with large contexts', () => {
      // Add many large messages
      for (let i = 0; i < 200; i++) {
        conversationManager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: 'Large message content about authentication system development. '.repeat(50) + `Message ${i}`
        });
      }

      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100);

      // Should still function properly
      const intent = conversationManager.detectIntent('test the authentication system');
      expect(intent.type).toBe('task');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed clarification responses gracefully', () => {
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Choose environment:',
        options: ['dev', 'staging', 'prod']
      });

      const malformedResponses = ['', '999', 'invalid-option', null, undefined];

      malformedResponses.forEach(response => {
        conversationManager.requestClarification({
          type: 'choice',
          question: 'Choose environment:',
          options: ['dev', 'staging', 'prod']
        });

        try {
          const result = conversationManager.provideClarification(response as string);
          expect(typeof result.matched).toBe('boolean');
        } catch (error) {
          // Error handling is acceptable for truly invalid input
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    it('should handle concurrent conversation operations', async () => {
      const operations = [];

      // Simulate concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          Promise.resolve().then(() => {
            conversationManager.addMessage({
              role: 'user',
              content: `Concurrent message ${i}`
            });

            return conversationManager.detectIntent(`create component ${i}`);
          })
        );
      }

      const results = await Promise.all(operations);

      results.forEach(intent => {
        expect(intent.type).toBe('task');
      });

      expect(conversationManager.getContext().messages.length).toBe(10);
    });

    it('should recover from context corruption gracefully', () => {
      // Add normal messages
      conversationManager.addMessage({ role: 'user', content: 'Normal message' });
      conversationManager.addMessage({ role: 'assistant', content: 'Normal response' });

      // Get context (creates a copy)
      const context = conversationManager.getContext();

      // Should continue working normally
      conversationManager.addMessage({ role: 'user', content: 'After corruption test' });

      const finalContext = conversationManager.getContext();
      expect(finalContext.messages.length).toBe(3);

      // Should still detect intents properly
      const intent = conversationManager.detectIntent('create a new feature');
      expect(intent.type).toBe('task');
    });
  });

  describe('Conversational Flow Integration', () => {
    it('should support natural conversation flow', () => {
      // Initial request
      conversationManager.addMessage({
        role: 'user',
        content: 'I need to build a user authentication system'
      });

      let intent = conversationManager.detectIntent('I need to build a user authentication system');
      expect(intent.type).toBe('task');
      expect(intent.metadata?.suggestedWorkflow).toBe('feature');

      // Assistant response and follow-up question
      conversationManager.addMessage({
        role: 'assistant',
        content: 'I\'ll help you build an authentication system. What type of authentication would you prefer?'
      });

      // Request clarification
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Choose authentication method:',
        options: ['JWT', 'Session-based', 'OAuth']
      });

      // User response
      let result = conversationManager.provideClarification('JWT');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('JWT');

      // Continue conversation
      conversationManager.addMessage({
        role: 'user',
        content: 'Make it secure and include password hashing'
      });

      intent = conversationManager.detectIntent('Make it secure and include password hashing');
      expect(intent.type).toBe('task');

      // Verify conversation context is maintained
      const summary = conversationManager.summarizeContext();
      expect(summary).toContain('authentication');
    });

    it('should handle clarification chains', () => {
      // First clarification
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Which database do you want to use?',
        options: ['PostgreSQL', 'MySQL', 'MongoDB']
      });

      let result = conversationManager.provideClarification('PostgreSQL');
      expect(result.matched).toBe(true);

      // Second clarification
      conversationManager.requestClarification({
        type: 'confirm',
        question: 'Do you want to include database migrations?'
      });

      result = conversationManager.provideClarification('yes');
      expect(result.matched).toBe(true);
      expect(result.value).toBe(true);

      // Verify context maintains both clarifications
      const context = conversationManager.getContext();
      expect(context.messages.length).toBe(4); // 2 clarifications + 2 responses
    });
  });

  describe('Intent Metadata Validation', () => {
    it('should provide consistent metadata for task intents', () => {
      const taskInputs = [
        'create a new component',
        'fix the authentication bug',
        'update the user interface',
        'remove old dependencies'
      ];

      taskInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.type).toBe('task');
        expect(intent.metadata).toBeDefined();
        expect(intent.metadata?.matchedPattern).toBeDefined();
        expect(intent.metadata?.suggestedWorkflow).toBeDefined();
        expect(intent.metadata?.estimatedComplexity).toBeDefined();
        expect(['simple', 'moderate', 'complex']).toContain(intent.metadata?.estimatedComplexity);
      });
    });

    it('should provide appropriate complexity estimates', () => {
      const complexityTests = [
        { input: 'fix typo in README', expectedComplexity: 'simple' },
        { input: 'delete unused file', expectedComplexity: 'simple' },
        { input: 'create a new component', expectedComplexity: 'moderate' },
        { input: 'refactor the database layer', expectedComplexity: 'moderate' },
        { input: 'deploy to production', expectedComplexity: 'complex' }
      ];

      complexityTests.forEach(({ input, expectedComplexity }) => {
        const intent = conversationManager.detectIntent(input);
        expect(intent.metadata?.estimatedComplexity).toBe(expectedComplexity);
      });
    });
  });
});