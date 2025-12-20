import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager, ConversationMessage, ClarificationRequest } from '../ConversationManager';

describe('ConversationManager Edge Cases', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  describe('Context Pruning Edge Cases', () => {
    it('should handle pruning when exactly at max message limit', () => {
      // Add exactly 100 messages
      for (let i = 0; i < 100; i++) {
        manager.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const contextBefore = manager.getContext();
      expect(contextBefore.messages).toHaveLength(100);

      // Add one more to trigger pruning
      manager.addMessage({
        role: 'user',
        content: 'Trigger pruning',
      });

      const contextAfter = manager.getContext();
      expect(contextAfter.messages).toHaveLength(100);
      expect(contextAfter.messages[0].content).toBe('Message 1'); // First message pruned
      expect(contextAfter.messages[99].content).toBe('Trigger pruning');
    });

    it('should handle very long messages that might exceed token limits', () => {
      // Add a very long message
      const longContent = 'A'.repeat(10000);
      manager.addMessage({
        role: 'user',
        content: longContent,
      });

      // Add more messages to test token-based pruning
      for (let i = 0; i < 50; i++) {
        manager.addMessage({
          role: 'user',
          content: `Additional message ${i} with some content`,
        });
      }

      const context = manager.getContext();
      // Should have pruned some messages due to token limit
      expect(context.messages.length).toBeLessThanOrEqual(100);
    });

    it('should preserve recent messages during aggressive pruning', () => {
      // Fill with many messages
      for (let i = 0; i < 150; i++) {
        manager.addMessage({
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const context = manager.getContext();
      expect(context.messages).toHaveLength(100);

      // Should have the most recent messages
      const recentMessages = manager.getRecentMessages(10);
      expect(recentMessages).toHaveLength(10);
      expect(recentMessages[9].content).toBe('Message 149');
    });
  });

  describe('Clarification Edge Cases', () => {
    it('should handle clarification without pending request', () => {
      const result = manager.provideClarification('yes');
      expect(result).toEqual({ matched: false });
    });

    it('should handle edge case confirmation responses', () => {
      manager.requestClarification({
        question: 'Are you sure?',
        type: 'confirm'
      });

      // Test edge case affirmatives
      expect(manager.provideClarification('SURE').value).toBe(true);

      manager.requestClarification({
        question: 'Continue?',
        type: 'confirm'
      });
      expect(manager.provideClarification('1').value).toBe(true);

      manager.requestClarification({
        question: 'Proceed?',
        type: 'confirm'
      });
      expect(manager.provideClarification('TRUE').value).toBe(true);

      // Test edge case negatives
      manager.requestClarification({
        question: 'Delete file?',
        type: 'confirm'
      });
      expect(manager.provideClarification('ABORT').value).toBe(false);

      manager.requestClarification({
        question: 'Continue?',
        type: 'confirm'
      });
      expect(manager.provideClarification('0').value).toBe(false);
    });

    it('should handle ambiguous confirmation responses', () => {
      manager.requestClarification({
        question: 'Are you sure?',
        type: 'confirm'
      });

      const result = manager.provideClarification('maybe');
      expect(result.matched).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should handle choice clarifications with exact matches', () => {
      manager.requestClarification({
        question: 'Choose an option',
        type: 'choice',
        options: ['option A', 'option B', 'option C']
      });

      const result = manager.provideClarification('option B');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('option B');
      expect(result.index).toBe(1);
    });

    it('should handle choice clarifications with partial matches', () => {
      manager.requestClarification({
        question: 'Choose deployment environment',
        type: 'choice',
        options: ['development', 'staging', 'production']
      });

      const result = manager.provideClarification('prod');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('production');
      expect(result.index).toBe(2);
    });

    it('should handle choice clarifications with index selection', () => {
      manager.requestClarification({
        question: 'Select option',
        type: 'choice',
        options: ['first', 'second', 'third']
      });

      const result = manager.provideClarification('2');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('second');
      expect(result.index).toBe(1);
    });

    it('should handle invalid choice selections', () => {
      manager.requestClarification({
        question: 'Choose option',
        type: 'choice',
        options: ['option1', 'option2']
      });

      const result = manager.provideClarification('invalid option');
      expect(result.matched).toBe(false);
    });

    it('should handle choice selection with out-of-bounds index', () => {
      manager.requestClarification({
        question: 'Choose option',
        type: 'choice',
        options: ['option1', 'option2']
      });

      const result = manager.provideClarification('5');
      expect(result.matched).toBe(false);
    });

    it('should handle freeform clarifications', () => {
      manager.requestClarification({
        question: 'Please provide details',
        type: 'freeform'
      });

      const result = manager.provideClarification('Here are the details you requested');
      expect(result.matched).toBe(true);
      expect(result.value).toBe('Here are the details you requested');
    });

    it('should clear pending clarification after providing response', () => {
      manager.requestClarification({
        question: 'Confirm action',
        type: 'confirm'
      });

      let context = manager.getContext();
      expect(context.pendingClarification).toBeDefined();

      manager.provideClarification('yes');

      context = manager.getContext();
      expect(context.pendingClarification).toBeUndefined();
    });
  });

  describe('Message Management Edge Cases', () => {
    it('should handle getRecentMessages with count larger than total messages', () => {
      manager.addMessage({ role: 'user', content: 'Only message' });

      const recent = manager.getRecentMessages(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].content).toBe('Only message');
    });

    it('should handle getRecentMessages with zero count', () => {
      manager.addMessage({ role: 'user', content: 'Message' });

      const recent = manager.getRecentMessages(0);
      expect(recent).toHaveLength(0);
    });

    it('should preserve message metadata', () => {
      const metadata = { userId: '123', sessionId: 'abc' };
      manager.addMessage({
        role: 'user',
        content: 'Message with metadata',
        metadata
      });

      const context = manager.getContext();
      expect(context.messages[0].metadata).toEqual(metadata);
    });

    it('should add timestamps to messages', () => {
      const before = Date.now();
      manager.addMessage({ role: 'user', content: 'Test' });
      const after = Date.now();

      const context = manager.getContext();
      const messageTime = context.messages[0].timestamp.getTime();
      expect(messageTime).toBeGreaterThanOrEqual(before);
      expect(messageTime).toBeLessThanOrEqual(after);
    });
  });

  describe('Context State Management Edge Cases', () => {
    it('should handle clearing task when none is set', () => {
      expect(() => manager.clearTask()).not.toThrow();
      expect(manager.getContext().currentTaskId).toBeUndefined();
    });

    it('should handle clearing agent when none is set', () => {
      expect(() => manager.clearAgent()).not.toThrow();
      expect(manager.getContext().activeAgent).toBeUndefined();
    });

    it('should allow setting same task/agent multiple times', () => {
      manager.setTask('task1');
      manager.setTask('task1');
      expect(manager.getContext().currentTaskId).toBe('task1');

      manager.setAgent('agent1');
      manager.setAgent('agent1');
      expect(manager.getContext().activeAgent).toBe('agent1');
    });

    it('should handle workflow stage transitions', () => {
      manager.setWorkflowStage('planning');
      expect(manager.getContext().workflowStage).toBe('planning');

      manager.setWorkflowStage('implementation');
      expect(manager.getContext().workflowStage).toBe('implementation');

      manager.setWorkflowStage('testing');
      expect(manager.getContext().workflowStage).toBe('testing');
    });

    it('should maintain immutability of returned context', () => {
      manager.addMessage({ role: 'user', content: 'Original' });
      const context1 = manager.getContext();
      const context2 = manager.getContext();

      // Contexts should be separate objects
      expect(context1).not.toBe(context2);

      // Modifying returned context shouldn't affect manager state
      context1.currentTaskId = 'modified';
      expect(manager.getContext().currentTaskId).toBeUndefined();
    });
  });

  describe('Clarification Formatting Edge Cases', () => {
    it('should handle clarification requests without options', () => {
      manager.requestClarification({
        question: 'Please provide input',
        type: 'freeform'
      });

      const context = manager.getContext();
      const lastMessage = context.messages[context.messages.length - 1];
      expect(lastMessage.content).toContain('Please provide input');
      expect(lastMessage.role).toBe('system');
    });

    it('should format choice clarifications with numbered options', () => {
      manager.requestClarification({
        question: 'Choose option',
        type: 'choice',
        options: ['first', 'second', 'third']
      });

      const context = manager.getContext();
      const lastMessage = context.messages[context.messages.length - 1];
      expect(lastMessage.content).toContain('1. first');
      expect(lastMessage.content).toContain('2. second');
      expect(lastMessage.content).toContain('3. third');
    });

    it('should format confirmation clarifications appropriately', () => {
      manager.requestClarification({
        question: 'Are you sure?',
        type: 'confirm'
      });

      const context = manager.getContext();
      const lastMessage = context.messages[context.messages.length - 1];
      expect(lastMessage.content).toContain('Are you sure?');
      expect(lastMessage.content).toContain('yes/no');
    });
  });
});