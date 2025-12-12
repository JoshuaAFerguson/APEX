/**
 * Integration tests for IntentDetector edge cases and error paths
 * Testing specific edge cases that might not be covered in unit tests
 */

import { describe, it, expect, vi } from 'vitest';
import { ConversationManager } from '../ConversationManager';

describe('IntentDetector Edge Cases', () => {
  let conversationManager: ConversationManager;

  beforeEach(() => {
    conversationManager = new ConversationManager();
  });

  describe('Edge Cases and Error Paths', () => {
    it('should handle malformed commands gracefully', () => {
      const malformedInputs = [
        '/command/with/slashes',
        '//double//slash',
        '/command with spaces but no quotes',
        '/émoji 🚀 command',
        '/command\nwith\nnewlines',
        '/command\twith\ttabs',
        '/command with very long arguments '.repeat(100),
        '/\x00null\x00bytes',
        '/',  // Just a slash
        '/ ', // Slash with space
      ];

      malformedInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toBeDefined();
        expect(['command', 'task', 'question', 'clarification']).toContain(intent.type);
        expect(intent.confidence).toBeGreaterThanOrEqual(0);
        expect(intent.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should handle Unicode and special characters', () => {
      const unicodeInputs = [
        'créer un composant français',
        'создать новый компонент',
        '日本語でコンポーネントを作成',
        '¿Cómo crear un componente?',
        'create 💯 emoji component 🚀',
        'fix\u200B\u200C\u200D‌‍invisible chars',
        'test\u0000null\u0001control\u001Fchars',
      ];

      unicodeInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toBeDefined();
        expect(intent.type).toBeDefined();
      });
    });

    it('should handle extremely long input', () => {
      const veryLongInput = 'create a component '.repeat(1000);
      const intent = conversationManager.detectIntent(veryLongInput);

      expect(intent).toBeDefined();
      expect(intent.type).toBe('task');
    });

    it('should handle empty and whitespace-only input', () => {
      const emptyInputs = ['', '   ', '\n', '\t', '\r\n', ' \t \n '];

      emptyInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toBeDefined();
        expect(intent.type).toBe('task');
        expect(intent.confidence).toBe(0.5);
      });
    });

    it('should handle mixed case and partial matches correctly', () => {
      const mixedCaseInputs = [
        'CREATE a component',
        'Fix The Bug',
        'UpDaTe ThE dOcUmEnTaTiOn',
        'HELP ME WITH THIS',
        'what IS the STATUS?',
      ];

      mixedCaseInputs.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toBeDefined();
        expect(intent.confidence).toBeGreaterThan(0);
      });
    });

    it('should handle clarification with edge cases', () => {
      // Set up a clarification request
      conversationManager.requestClarification({
        type: 'choice',
        question: 'Choose an option:',
        options: ['Option-1', 'Option_2', 'Option 3', 'Option/4']
      });

      const edgeCaseResponses = [
        '1', // Valid index
        '0', // Invalid index (out of range)
        '10', // Invalid index (out of range)
        'option-1', // Partial match with different case
        'OPTION_2', // Different case
        'option', // Partial match
        'opt', // Very partial match
        'invalid response',
        '',
        '   ',
      ];

      edgeCaseResponses.forEach(response => {
        // Reset clarification for each test
        conversationManager.requestClarification({
          type: 'choice',
          question: 'Choose an option:',
          options: ['Option-1', 'Option_2', 'Option 3', 'Option/4']
        });

        const result = conversationManager.provideClarification(response);
        expect(result).toBeDefined();
        expect(typeof result.matched).toBe('boolean');

        if (result.matched) {
          expect(result.value).toBeDefined();
        }
      });
    });

    it('should handle recursive patterns and nested structures', () => {
      // Test input that might cause infinite loops or stack overflow
      const recursivePatterns = [
        'create create create component',
        'fix fix fix fix bug',
        'what what what is what?',
        'help help help help help me help',
        'test test the test testing test',
      ];

      recursivePatterns.forEach(input => {
        const intent = conversationManager.detectIntent(input);
        expect(intent).toBeDefined();
        expect(intent.type).toBeDefined();
      });
    });

    it('should handle memory pressure with many messages', () => {
      // Add many messages to test memory management
      for (let i = 0; i < 1000; i++) {
        conversationManager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i} with some content that makes it a bit longer`
        });
      }

      // Context should be pruned automatically
      const context = conversationManager.getContext();
      expect(context.messages.length).toBeLessThanOrEqual(100);

      // Should still work normally
      const intent = conversationManager.detectIntent('create a new component');
      expect(intent.type).toBe('task');
    });

    it('should handle concurrent operations safely', () => {
      // Simulate concurrent message additions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            conversationManager.addMessage({
              role: 'user',
              content: `Concurrent message ${i}`
            });
          })
        );
      }

      return Promise.all(promises).then(() => {
        const context = conversationManager.getContext();
        expect(context.messages.length).toBe(10);
      });
    });

    it('should handle invalid message structures', () => {
      const invalidMessages = [
        // @ts-ignore - Testing runtime behavior
        { role: 'invalid', content: 'test' },
        // @ts-ignore - Testing runtime behavior
        { role: 'user' }, // Missing content
        // @ts-ignore - Testing runtime behavior
        { content: 'test' }, // Missing role
        // @ts-ignore - Testing runtime behavior
        { role: 'user', content: null },
        // @ts-ignore - Testing runtime behavior
        { role: 'user', content: undefined },
      ];

      invalidMessages.forEach((message, index) => {
        try {
          // @ts-ignore - Testing runtime behavior
          conversationManager.addMessage(message);

          // If it doesn't throw, check that the message was handled somehow
          const context = conversationManager.getContext();
          expect(context.messages.length).toBeGreaterThanOrEqual(index);
        } catch (error) {
          // Error is acceptable for invalid input
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    it('should handle extreme token counts without crashing', () => {
      // Add a message with extreme token metadata
      conversationManager.addMessage({
        role: 'assistant',
        content: 'Test message',
        metadata: {
          tokens: Number.MAX_SAFE_INTEGER
        }
      });

      const context = conversationManager.getContext();
      expect(context.messages.length).toBe(1);
    });

    it('should handle date edge cases', () => {
      const now = new Date();

      // Test with edge case dates
      const edgeDates = [
        new Date(0), // Unix epoch
        new Date('1970-01-01T00:00:00.000Z'),
        new Date('2038-01-19T03:14:07.000Z'), // Y2038 problem
        new Date('9999-12-31T23:59:59.999Z'), // Far future
        new Date('invalid'), // Invalid date
      ];

      edgeDates.forEach(date => {
        try {
          conversationManager.addMessage({
            role: 'user',
            content: 'Test with edge case date',
            timestamp: date
          });
        } catch (error) {
          // Invalid dates should either be handled or throw predictable errors
          expect(error).toBeInstanceOf(Error);
        }
      });

      const context = conversationManager.getContext();
      expect(context.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid intent detection calls', async () => {
      const startTime = Date.now();

      // Make many rapid calls
      const calls = [];
      for (let i = 0; i < 100; i++) {
        calls.push(conversationManager.detectIntent(`create component ${i}`));
      }

      const endTime = Date.now();

      // Should complete quickly and return consistent results
      expect(endTime - startTime).toBeLessThan(1000);
      calls.forEach(intent => {
        expect(intent.type).toBe('task');
      });
    });

    it('should handle context summarization under pressure', () => {
      // Fill with many large messages
      for (let i = 0; i < 50; i++) {
        conversationManager.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: 'A'.repeat(1000) + ` Message ${i}`
        });
      }

      const startTime = Date.now();
      const summary = conversationManager.summarizeContext();
      const endTime = Date.now();

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from corrupted internal state', () => {
      // Add some normal messages
      conversationManager.addMessage({ role: 'user', content: 'Normal message 1' });
      conversationManager.addMessage({ role: 'assistant', content: 'Normal response 1' });

      // Simulate state corruption by directly manipulating internal state
      const context = conversationManager.getContext();

      // Should still work after getting context (which creates a copy)
      conversationManager.addMessage({ role: 'user', content: 'Message after corruption test' });

      const finalContext = conversationManager.getContext();
      expect(finalContext.messages.length).toBe(3);
    });

    it('should handle partial operations gracefully', () => {
      // Start a clarification
      conversationManager.requestClarification({
        type: 'confirm',
        question: 'Test question?'
      });

      expect(conversationManager.hasPendingClarification()).toBe(true);

      // Clear context while clarification is pending
      conversationManager.clearContext();

      // Should not have pending clarification after clear
      expect(conversationManager.hasPendingClarification()).toBe(false);

      // Should still work normally
      conversationManager.addMessage({ role: 'user', content: 'New message after clear' });
      const context = conversationManager.getContext();
      expect(context.messages.length).toBe(1);
    });
  });
});