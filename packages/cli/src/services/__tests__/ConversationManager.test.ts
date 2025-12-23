import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConversationManager,
  ConversationMessage,
  ClarificationRequest,
  ConversationContext
} from '../ConversationManager';

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should start with empty context', () => {
      const context = manager.getContext();

      expect(context.messages).toEqual([]);
      expect(context.pendingClarification).toBeUndefined();
      expect(context.currentTaskId).toBeUndefined();
      expect(context.activeAgent).toBeUndefined();
      expect(context.workflowStage).toBeUndefined();
    });
  });

  describe('message management', () => {
    it('should add messages with timestamp', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(baseTime);

      manager.addMessage({
        role: 'user',
        content: 'Hello, APEX!'
      });

      const context = manager.getContext();
      expect(context.messages).toHaveLength(1);

      const message = context.messages[0];
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, APEX!');
      expect(message.timestamp).toEqual(baseTime);
    });

    it('should add multiple messages in order', () => {
      manager.addMessage({ role: 'user', content: 'First message' });
      manager.addMessage({ role: 'assistant', content: 'Second message' });
      manager.addMessage({ role: 'user', content: 'Third message' });

      const messages = manager.getContext().messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should add messages with metadata', () => {
      manager.addMessage({
        role: 'assistant',
        content: 'Response with metadata',
        metadata: { agent: 'planner', tokens: 100 }
      });

      const message = manager.getContext().messages[0];
      expect(message.metadata).toEqual({ agent: 'planner', tokens: 100 });
    });

    it('should get recent messages', () => {
      // Add 15 messages
      for (let i = 1; i <= 15; i++) {
        manager.addMessage({ role: 'user', content: `Message ${i}` });
      }

      const recent5 = manager.getRecentMessages(5);
      expect(recent5).toHaveLength(5);
      expect(recent5[0].content).toBe('Message 11');
      expect(recent5[4].content).toBe('Message 15');

      const recent10 = manager.getRecentMessages(10);
      expect(recent10).toHaveLength(10);
      expect(recent10[0].content).toBe('Message 6');

      const defaultRecent = manager.getRecentMessages();
      expect(defaultRecent).toHaveLength(10); // Default count
    });
  });

  describe('context management', () => {
    it('should prune messages when over message limit', () => {
      // Add more than max messages (100)
      for (let i = 1; i <= 105; i++) {
        manager.addMessage({ role: 'user', content: `Message ${i}` });
      }

      const messages = manager.getContext().messages;
      expect(messages.length).toBeLessThanOrEqual(100);
      expect(messages[0].content).toBe('Message 6'); // First 5 pruned
    });

    it('should prune messages when over token limit', () => {
      // Add messages with large content to exceed token limit
      const largeContent = 'x'.repeat(50000); // ~12500 tokens

      for (let i = 0; i < 5; i++) {
        manager.addMessage({ role: 'user', content: largeContent });
      }

      const messages = manager.getContext().messages;
      expect(messages.length).toBeGreaterThan(1); // Should keep at least some messages
      expect(messages.length).toBeLessThan(5); // Should prune some
    });

    it('should maintain minimum messages when pruning', () => {
      // Add messages that would normally be pruned to below 10
      const largeContent = 'x'.repeat(200000); // Very large content

      for (let i = 0; i < 15; i++) {
        manager.addMessage({ role: 'user', content: largeContent });
      }

      const messages = manager.getContext().messages;
      expect(messages.length).toBeGreaterThanOrEqual(10); // Should maintain minimum
    });

    it('should clear context', () => {
      manager.addMessage({ role: 'user', content: 'Test message' });
      manager.setTask('task-123');
      manager.setAgent('planner');

      manager.clearContext();

      const context = manager.getContext();
      expect(context.messages).toEqual([]);
      expect(context.currentTaskId).toBeUndefined();
      expect(context.activeAgent).toBeUndefined();
    });

    it('should summarize context', () => {
      // Empty context
      expect(manager.summarizeContext()).toBe('No conversation history.');

      // Add some messages
      manager.addMessage({ role: 'user', content: 'First message' });
      manager.addMessage({ role: 'assistant', content: 'Assistant response' });
      manager.addMessage({ role: 'user', content: 'Another user message' });

      const summary = manager.summarizeContext();
      expect(summary).toContain('Recent conversation (3 total messages)');
      expect(summary).toContain('user: First message');
      expect(summary).toContain('assistant: Assistant response');
    });

    it('should truncate long content in summary', () => {
      const longContent = 'x'.repeat(200);
      manager.addMessage({ role: 'user', content: longContent });

      const summary = manager.summarizeContext();
      expect(summary).toContain('...');
      expect(summary).not.toContain(longContent);
    });
  });

  describe('task and agent management', () => {
    it('should set and clear task ID', () => {
      manager.setTask('task-123');
      expect(manager.getContext().currentTaskId).toBe('task-123');

      manager.clearTask();
      expect(manager.getContext().currentTaskId).toBeUndefined();
    });

    it('should set and clear agent', () => {
      manager.setAgent('planner');
      expect(manager.getContext().activeAgent).toBe('planner');

      manager.clearAgent();
      expect(manager.getContext().activeAgent).toBeUndefined();
    });

    it('should set workflow stage', () => {
      manager.setWorkflowStage('implementation');
      expect(manager.getContext().workflowStage).toBe('implementation');
    });
  });

  describe('clarification handling', () => {
    it('should request confirmation', () => {
      const request: ClarificationRequest = {
        type: 'confirm',
        question: 'Do you want to proceed with deployment?'
      };

      manager.requestClarification(request);

      const context = manager.getContext();
      expect(context.pendingClarification).toEqual(request);
      expect(manager.hasPendingClarification()).toBe(true);

      // Should add system message
      const lastMessage = context.messages[context.messages.length - 1];
      expect(lastMessage.role).toBe('system');
      expect(lastMessage.content).toContain('Do you want to proceed');
      expect(lastMessage.content).toContain('(yes/no)');
    });

    it('should request choice', () => {
      const request: ClarificationRequest = {
        type: 'choice',
        question: 'Which environment should I deploy to?',
        options: ['development', 'staging', 'production']
      };

      manager.requestClarification(request);

      const context = manager.getContext();
      const lastMessage = context.messages[context.messages.length - 1];
      expect(lastMessage.content).toContain('Which environment');
      expect(lastMessage.content).toContain('1. development');
      expect(lastMessage.content).toContain('2. staging');
      expect(lastMessage.content).toContain('3. production');
    });

    it('should request freeform input', () => {
      const request: ClarificationRequest = {
        type: 'freeform',
        question: 'Please provide the database connection string:'
      };

      manager.requestClarification(request);

      const context = manager.getContext();
      expect(context.pendingClarification).toEqual(request);

      const lastMessage = context.messages[context.messages.length - 1];
      expect(lastMessage.content).toBe('Please provide the database connection string:');
    });

    it('should handle confirmation responses', () => {
      manager.requestClarification({
        type: 'confirm',
        question: 'Proceed?'
      });

      // Test positive responses
      const positiveResponses = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'true', '1'];
      for (const response of positiveResponses) {
        manager.requestClarification({ type: 'confirm', question: 'Test?' });
        const result = manager.provideClarification(response);
        expect(result.matched).toBe(true);
        expect(result.value).toBe(true);
      }

      // Test negative responses
      const negativeResponses = ['no', 'n', 'nope', 'nah', 'cancel', 'abort', 'false', '0'];
      for (const response of negativeResponses) {
        manager.requestClarification({ type: 'confirm', question: 'Test?' });
        const result = manager.provideClarification(response);
        expect(result.matched).toBe(true);
        expect(result.value).toBe(false);
      }

      // Test invalid response
      manager.requestClarification({ type: 'confirm', question: 'Test?' });
      const invalidResult = manager.provideClarification('maybe');
      expect(invalidResult.matched).toBe(false);
    });

    it('should handle choice responses', () => {
      manager.requestClarification({
        type: 'choice',
        question: 'Choose environment:',
        options: ['dev', 'staging', 'prod']
      });

      // Test numeric choice
      const numericResult = manager.provideClarification('2');
      expect(numericResult.matched).toBe(true);
      expect(numericResult.value).toBe('staging');
      expect(numericResult.index).toBe(1);

      // Test exact text match
      manager.requestClarification({
        type: 'choice',
        question: 'Choose:',
        options: ['dev', 'staging', 'prod']
      });
      const exactResult = manager.provideClarification('staging');
      expect(exactResult.matched).toBe(true);
      expect(exactResult.value).toBe('staging');

      // Test fuzzy match
      manager.requestClarification({
        type: 'choice',
        question: 'Choose:',
        options: ['development', 'staging', 'production']
      });
      const fuzzyResult = manager.provideClarification('dev');
      expect(fuzzyResult.matched).toBe(true);
      expect(fuzzyResult.value).toBe('development');

      // Test invalid choice
      manager.requestClarification({
        type: 'choice',
        question: 'Choose:',
        options: ['dev', 'staging', 'prod']
      });
      const invalidResult = manager.provideClarification('invalid');
      expect(invalidResult.matched).toBe(false);

      // Test out of range number
      const outOfRangeResult = manager.provideClarification('5');
      expect(outOfRangeResult.matched).toBe(false);
    });

    it('should handle freeform responses', () => {
      manager.requestClarification({
        type: 'freeform',
        question: 'Enter connection string:'
      });

      const result = manager.provideClarification('postgresql://localhost:5432/mydb');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('postgresql://localhost:5432/mydb');
    });

    it('should clear pending clarification after response', () => {
      manager.requestClarification({
        type: 'confirm',
        question: 'Proceed?'
      });

      expect(manager.hasPendingClarification()).toBe(true);

      manager.provideClarification('yes');
      expect(manager.hasPendingClarification()).toBe(false);
      expect(manager.getContext().pendingClarification).toBeUndefined();
    });

    it('should add user message when providing clarification', () => {
      manager.requestClarification({
        type: 'confirm',
        question: 'Proceed?'
      });

      const messagesBefore = manager.getContext().messages.length;
      manager.provideClarification('yes');
      const messagesAfter = manager.getContext().messages.length;

      expect(messagesAfter).toBe(messagesBefore + 1);
      const lastMessage = manager.getRecentMessages(1)[0];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toBe('yes');
    });

    it('should return false when no pending clarification', () => {
      const result = manager.provideClarification('yes');
      expect(result.matched).toBe(false);
    });
  });

  describe('intent detection', () => {
    it('should detect commands', () => {
      const intent = manager.detectIntent('/help');
      expect(intent.type).toBe('command');
      expect(intent.confidence).toBe(1.0);
    });

    it('should detect clarification responses', () => {
      manager.requestClarification({
        type: 'confirm',
        question: 'Proceed?'
      });

      const intent = manager.detectIntent('yes');
      expect(intent.type).toBe('clarification');
      expect(intent.confidence).toBe(0.9);
    });

    it('should detect questions', () => {
      const questionPatterns = [
        'What is the current status?',
        'How do I configure this?',
        'Where are the logs?',
        'When will this be done?',
        'Why did this fail?',
        'Who is responsible for this?',
        'Can you help me?',
        'Could this work?',
        'Would you recommend this?',
        'Should I proceed?',
        'Is this correct?',
        'Are the tests passing?',
        'Do the changes look good?',
        'Does this implementation work?',
        'Will this break anything?',
        'What about error handling?',
        'Explain this code',
        'Tell me about the architecture',
        'Show me the logs',
        'Help me understand this',
      ];

      for (const question of questionPatterns) {
        const intent = manager.detectIntent(question);
        expect(intent.type).toBe('question');
        expect(intent.confidence).toBe(0.8);
      }
    });

    it('should detect tasks', () => {
      const taskPatterns = [
        'Create a new component',
        'Make a login form',
        'Build the API',
        'Add authentication',
        'Implement the feature',
        'Write tests for this',
        'Develop the frontend',
        'Generate documentation',
        'Fix the bug in payment',
        'Solve this issue',
        'Resolve the conflict',
        'Debug the error',
        'Correct the typo',
        'Update the dependencies',
        'Modify the config',
        'Change the styling',
        'Edit the README',
        'Refactor this code',
        'Remove the old files',
        'Delete the unused code',
        'Clean up the project',
        'Clear the cache',
        'Test this feature',
        'Check the logs',
        'Verify the implementation',
        'Validate the input',
        'Deploy to production',
        'Install the packages',
        'Setup the environment',
        'Configure the database',
      ];

      for (const task of taskPatterns) {
        const intent = manager.detectIntent(task);
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBe(0.8);
      }
    });

    it('should default to task for ambiguous input', () => {
      const intent = manager.detectIntent('something random');
      expect(intent.type).toBe('task');
      expect(intent.confidence).toBe(0.5);
    });
  });

  describe('smart suggestions', () => {
    it('should suggest clarification options', () => {
      manager.requestClarification({
        type: 'confirm',
        question: 'Proceed?'
      });

      const suggestions = manager.getSuggestions();
      expect(suggestions).toContain('yes');
      expect(suggestions).toContain('no');
    });

    it('should suggest choice options', () => {
      manager.requestClarification({
        type: 'choice',
        question: 'Choose:',
        options: ['dev', 'staging', 'prod']
      });

      const suggestions = manager.getSuggestions();
      expect(suggestions).toContain('dev');
      expect(suggestions).toContain('staging');
      expect(suggestions).toContain('prod');
    });

    it('should suggest error-related actions', () => {
      manager.addMessage({
        role: 'assistant',
        content: 'The deployment failed with an error in the database connection.'
      });

      const suggestions = manager.getSuggestions();
      expect(suggestions).toContain('retry the task');
      expect(suggestions).toContain('fix the error');
      expect(suggestions).toContain('show me the logs');
      expect(suggestions).toContain('try a different approach');
    });

    it('should suggest completion-related actions', () => {
      manager.addMessage({
        role: 'assistant',
        content: 'The feature has been successfully implemented and all tests are passing.'
      });

      const suggestions = manager.getSuggestions();
      expect(suggestions).toContain('show me the changes');
      expect(suggestions).toContain('test the implementation');
      expect(suggestions).toContain('create a pull request');
      expect(suggestions).toContain('deploy the changes');
    });

    it('should suggest task-related actions when task is active', () => {
      manager.setTask('task-123');

      const suggestions = manager.getSuggestions();
      expect(suggestions).toContain('/status');
      expect(suggestions).toContain('/logs');
      expect(suggestions).toContain('cancel the task');
      expect(suggestions).toContain('modify the requirements');
    });

    it('should provide general suggestions when no context', () => {
      const suggestions = manager.getSuggestions();
      expect(suggestions).toContain('create a new feature');
      expect(suggestions).toContain('fix a bug');
      expect(suggestions).toContain('refactor code');
      expect(suggestions).toContain('write tests');
      expect(suggestions).toContain('/help');
      expect(suggestions).toContain('/status');
    });

    it('should limit suggestions to 8 items', () => {
      manager.setTask('task-123'); // Add task context
      manager.addMessage({
        role: 'assistant',
        content: 'Task completed successfully'
      });

      const suggestions = manager.getSuggestions();
      expect(suggestions.length).toBeLessThanOrEqual(8);
    });
  });

  describe('context immutability', () => {
    it('should return context copy, not reference', () => {
      manager.addMessage({ role: 'user', content: 'Test' });
      const context1 = manager.getContext();
      const context2 = manager.getContext();

      expect(context1).not.toBe(context2); // Different objects
      expect(context1.messages).toEqual(context2.messages); // Same content
    });

    it('should not affect internal state when modifying returned context', () => {
      manager.addMessage({ role: 'user', content: 'Test' });
      const context = manager.getContext();

      // Modify returned context
      context.messages.push({
        role: 'system',
        content: 'Modified',
        timestamp: new Date()
      });

      // Internal state should be unchanged
      const internalContext = manager.getContext();
      expect(internalContext.messages).toHaveLength(1);
      expect(internalContext.messages[0].content).toBe('Test');
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages gracefully', () => {
      manager.addMessage({ role: 'user', content: '' });

      const intent = manager.detectIntent('');
      expect(intent.type).toBe('task');

      const summary = manager.summarizeContext();
      expect(summary).toContain('user: ...');
    });

    it('should handle very long messages', () => {
      const longContent = 'x'.repeat(10000);
      manager.addMessage({ role: 'user', content: longContent });

      const summary = manager.summarizeContext();
      expect(summary).toContain('...');
    });

    it('should handle special characters in clarification', () => {
      manager.requestClarification({
        type: 'choice',
        question: 'Choose:',
        options: ['Option 1', 'Option-2', 'option_3']
      });

      const result = manager.provideClarification('option_3');
      expect(result.matched).toBe(true);
    });

    it('should handle case sensitivity in responses', () => {
      manager.requestClarification({
        type: 'confirm',
        question: 'Proceed?'
      });

      const result = manager.provideClarification('YES');
      expect(result.matched).toBe(true);
      expect(result.value).toBe(true);
    });
  });
});
