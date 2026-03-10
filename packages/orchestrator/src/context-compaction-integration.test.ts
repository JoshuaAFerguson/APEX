import { describe, it, expect } from 'vitest';
import { SmartContextManager } from './smart-context-manager';
import {
  createContextSummary,
  compactConversation,
  estimateConversationTokens,
  analyzeConversation
} from './context';
import type { AgentMessage, ProjectContext } from '@apexcli/core';

/**
 * Context Compaction Strategies Implementation Audit Tests
 *
 * These tests verify the acceptance criteria:
 * 1. context.ts has createContextSummary function ✓
 * 2. truncation/summarization strategies exist in smart-context-manager.ts ✓
 * 3. context is compacted when reaching token limits ✓
 * 4. context-related tests pass ✓
 */
describe('Context Compaction Strategies Implementation Audit', () => {
  describe('Acceptance Criteria: createContextSummary function exists', () => {
    it('should have createContextSummary function in context.ts', () => {
      expect(typeof createContextSummary).toBe('function');

      const testMessages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Test request' }]
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'I will implement this feature' }]
        }
      ];

      const summary = createContextSummary(testMessages);
      expect(typeof summary).toBe('string');
      expect(summary).toContain('Previous Context Summary');
      expect(summary).toContain('Messages exchanged: 2');
    });
  });

  describe('Acceptance Criteria: truncation/summarization strategies in SmartContextManager', () => {
    let manager: SmartContextManager;

    beforeEach(() => {
      manager = new SmartContextManager({
        maxTokensPerTask: 100000,
        contextBudgetPercent: 0.25,
      });
    });

    it('should have truncateToFit method that truncates content when exceeding budget', () => {
      const largeContent = 'A'.repeat(50000); // 12500 tokens, exceeds 10k budget

      const context = manager.buildContext({
        taskDescription: 'Test truncation',
        enrichedContext: largeContent,
      });

      // Should be truncated to fit within budget
      const section = context.visualization.sections.find(s => s.name === 'Codebase Intelligence');
      expect(section!.usedTokens).toBeLessThanOrEqual(10000);
      expect(context.enrichedContext).toContain('...truncated');
    });

    it('should have token estimation methods', () => {
      const testText = 'Hello world';
      const context = manager.buildContext({
        taskDescription: 'Test estimation',
        enrichedContext: testText,
      });

      // Should estimate tokens correctly (rough approximation)
      const estimatedTokens = Math.ceil(testText.length / 4);
      const section = context.visualization.sections.find(s => s.name === 'Codebase Intelligence');
      expect(section!.usedTokens).toBe(estimatedTokens);
    });

    it('should allocate token budgets correctly', () => {
      const context = manager.buildContext({
        taskDescription: 'Test budget allocation',
      });

      // Budget allocation should follow the specified percentages
      expect(context.budget.projectContext).toBe(5000); // 20% of 25k
      expect(context.budget.codebaseIntelligence).toBe(10000); // 40% of 25k
      expect(context.budget.memory).toBe(5000); // 20% of 25k
      expect(context.budget.taskHistory).toBe(3000); // 12% of 25k
      expect(context.budget.livingMemory).toBe(2000); // 8% of 25k
    });

    it('should truncate different content types to fit their budgets', () => {
      const projectContext: ProjectContext = {
        gitStatus: {
          branch: 'very-long-branch-name'.repeat(100),
          isDirty: true,
          staged: Array.from({ length: 500 }, (_, i) => `file${i}.ts`),
        },
        frameworks: Array.from({ length: 100 }, (_, i) => ({ name: `Framework${i}` })),
      };

      const mockMemoryManager = {
        buildMemoryContext: () => 'x'.repeat(30000), // Exceeds budget
        getLivingMemoryContent: () => 'y'.repeat(15000), // Exceeds budget
      } as any;

      const context = manager.buildContext({
        taskDescription: 'Test all content truncation',
        projectContext,
        enrichedContext: 'a'.repeat(60000), // Exceeds budget
        memoryManager: mockMemoryManager,
      });

      // All sections should be within their budgets
      for (const section of context.visualization.sections) {
        expect(section.usedTokens).toBeLessThanOrEqual(section.allocatedTokens);
      }

      // Total should not exceed overall budget
      expect(context.visualization.totalUsedTokens).toBeLessThanOrEqual(25000);
    });
  });

  describe('Acceptance Criteria: context compaction when reaching token limits', () => {
    it('should trigger conversation compaction when token limit is reached', () => {
      // Create a large conversation that exceeds typical limits
      const largeMessages: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{
          type: 'text',
          text: `This is message ${i} with substantial content that will contribute significantly to token usage. `.repeat(50) // Very long messages
        }],
      }));

      const originalTokens = estimateConversationTokens(largeMessages);
      expect(originalTokens).toBeGreaterThan(50000); // Verify we have a large conversation

      // Compact the conversation with a token limit
      const compacted = compactConversation(largeMessages, {
        maxTokens: 10000,
        maxRecentMessages: 5
      });

      const compactedTokens = estimateConversationTokens(compacted);

      // Should be significantly reduced
      expect(compactedTokens).toBeLessThan(originalTokens);
      expect(compactedTokens).toBeLessThanOrEqual(15000); // Some margin for estimation
    });

    it('should recommend appropriate compaction strategy based on conversation size', () => {
      // Small conversation - no compaction needed
      const smallMessages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Short message' }] }
      ];
      const smallAnalysis = analyzeConversation(smallMessages);
      expect(smallAnalysis.recommendedStrategy).toBe('none');

      // Large conversation - should recommend compaction
      // Create content large enough to exceed the 50k token threshold for truncate
      const largeMessages: AgentMessage[] = Array.from({ length: 100 }, () => ({
        type: 'assistant',
        content: [{ type: 'text', text: 'A'.repeat(2500) }], // 625 tokens each, 100 messages = 62.5k tokens
      }));
      const largeAnalysis = analyzeConversation(largeMessages);
      expect(['truncate', 'summarize', 'aggressive']).toContain(largeAnalysis.recommendedStrategy);
    });

    it('should integrate with SmartContextManager token budgets', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 10000, // Small budget to force compaction
        contextBudgetPercent: 0.5, // 50% = 5000 tokens for context
      });

      // Create content that would normally exceed the budget
      const largeEnrichedContext = 'Large codebase analysis content. '.repeat(1000);

      const context = manager.buildContext({
        taskDescription: 'Test integration with compaction',
        enrichedContext: largeEnrichedContext,
      });

      // Should stay within the allocated budget through truncation
      expect(context.visualization.totalUsedTokens).toBeLessThanOrEqual(5000);

      // Should indicate truncation occurred
      expect(context.enrichedContext).toContain('...truncated');
    });

    it('should handle aggressive compaction for very large conversations', () => {
      // Create an extremely large conversation
      const messages: AgentMessage[] = [
        // System message (should be preserved)
        { type: 'system', content: [{ type: 'text', text: 'System instructions' }] },

        // Many older messages (should be summarized/dropped)
        ...Array.from({ length: 50 }, (_, i) => ({
          type: 'assistant' as const,
          content: [{ type: 'text', text: 'Very long content that consumes many tokens. '.repeat(200) }],
        })),

        // Recent important messages (should be preserved)
        { type: 'user', content: [{ type: 'text', text: 'Important recent request' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'Important recent response' }] },
      ];

      const originalTokens = estimateConversationTokens(messages);
      expect(originalTokens).toBeGreaterThan(100000);

      // Apply aggressive compaction
      const compacted = compactConversation(messages, {
        maxTokens: 5000, // Very aggressive limit
        maxRecentMessages: 2,
        summarizeOlder: true
      });

      const compactedTokens = estimateConversationTokens(compacted);

      // Should be drastically reduced
      expect(compactedTokens).toBeLessThan(originalTokens * 0.2);

      // Should preserve system message
      expect(compacted[0].type).toBe('system');

      // Should preserve recent messages
      const lastMessage = compacted[compacted.length - 1];
      expect(lastMessage.content[0].text).toBe('Important recent response');
    });
  });

  describe('Acceptance Criteria: comprehensive edge cases', () => {
    it('should handle empty contexts gracefully', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 100000,
        contextBudgetPercent: 0.25,
      });

      const context = manager.buildContext({
        taskDescription: '',
        enrichedContext: '',
      });

      expect(context.visualization.totalUsedTokens).toBe(0);
      expect(context.visualization.sections).toHaveLength(0);
    });

    it('should handle null/undefined inputs gracefully', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 100000,
        contextBudgetPercent: 0.25,
      });

      const context = manager.buildContext({
        taskDescription: 'Test',
        projectContext: null as any,
        enrichedContext: undefined,
        memoryManager: undefined,
      });

      expect(context.projectContext).toBeUndefined();
      expect(context.enrichedContext).toBeUndefined();
      expect(context.memoryContext).toBeUndefined();
    });

    it('should handle extremely small token budgets', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 100, // Very small
        contextBudgetPercent: 0.25,
      });

      const context = manager.buildContext({
        taskDescription: 'Test with tiny budget',
        enrichedContext: 'Some content that might be truncated',
      });

      // Should still work without crashing
      expect(context.budget.codebaseIntelligence).toBe(10); // 40% of 25
      expect(context.visualization.totalTokenBudget).toBe(25);
    });

    it('should handle zero token budget', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 0,
        contextBudgetPercent: 0.25,
      });

      const context = manager.buildContext({
        taskDescription: 'Test with zero budget',
        enrichedContext: 'Content',
      });

      expect(context.budget.codebaseIntelligence).toBe(0);
      expect(context.visualization.totalTokenBudget).toBe(0);
    });

    it('should handle malformed conversation data in compaction', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: null as any }], // Malformed
        },
        {
          type: 'assistant',
          content: [], // Empty content
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Valid message' }],
        },
      ];

      // Should not crash
      expect(() => compactConversation(messages)).not.toThrow();
      expect(() => createContextSummary(messages)).not.toThrow();
      expect(() => analyzeConversation(messages)).not.toThrow();
    });
  });

  describe('Acceptance Criteria: integration and correctness', () => {
    it('should maintain context coherence through compaction cycles', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 50000,
        contextBudgetPercent: 0.3,
      });

      // Simulate a development workflow
      const workflowMessages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Implement user authentication' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'I will implement JWT-based authentication' }] },
        { type: 'assistant', content: [{ type: 'tool_use', toolName: 'Read', toolInput: { file_path: '/src/app.ts' } }] },
        { type: 'user', content: [{ type: 'tool_result', toolResult: 'App configuration code...' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'Creating authentication middleware' }] },
        { type: 'assistant', content: [{ type: 'tool_use', toolName: 'Write', toolInput: { file_path: '/src/auth.ts', content: 'auth code' } }] },
      ];

      // Test multiple compaction cycles
      let currentMessages = workflowMessages;
      for (let cycle = 0; cycle < 3; cycle++) {
        currentMessages = compactConversation(currentMessages, {
          maxTokens: 5000 - (cycle * 1000),
          maxRecentMessages: 3
        });

        // Should still be valid
        expect(currentMessages.length).toBeGreaterThan(0);
        expect(() => createContextSummary(currentMessages)).not.toThrow();
      }

      // Final compacted conversation should still contain essential information
      const finalSummary = createContextSummary(currentMessages);
      expect(finalSummary).toContain('Messages exchanged');
    });

    it('should demonstrate end-to-end context management workflow', () => {
      const manager = new SmartContextManager({
        maxTokensPerTask: 25000,
        contextBudgetPercent: 0.4, // 10k tokens for context
      });

      // 1. Build initial context
      const projectContext: ProjectContext = {
        gitStatus: { branch: 'feature/auth', isDirty: true, staged: ['auth.ts'] },
        frameworks: [{ name: 'Express' }, { name: 'TypeScript' }],
        testFrameworks: [{ name: 'Vitest' }],
      };

      const initialContext = manager.buildContext({
        taskDescription: 'Implement authentication system',
        projectContext,
        enrichedContext: 'Codebase analysis: existing auth stub found...',
      });

      expect(initialContext.visualization.totalUsedTokens).toBeGreaterThan(0);
      expect(initialContext.projectContext).toContain('feature/auth');

      // 2. Simulate conversation growth
      const conversationMessages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Add JWT authentication' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'I will implement secure JWT authentication with proper validation' }] },
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'assistant' as const,
          content: [{ type: 'text', text: `Step ${i}: Implementation details with substantial content...`.repeat(10) }],
        })),
      ];

      // 3. Apply compaction when needed
      const analysis = analyzeConversation(conversationMessages);
      if (analysis.recommendedStrategy !== 'none') {
        const compactedMessages = compactConversation(conversationMessages, {
          maxTokens: 8000,
          maxRecentMessages: 5
        });

        expect(compactedMessages.length).toBeLessThanOrEqual(conversationMessages.length);

        // 4. Create summary for context continuation
        const contextSummary = createContextSummary(compactedMessages);
        expect(contextSummary).toContain('JWT authentication');
        expect(contextSummary).toContain('Implementation details');
      }

      // 5. Build new context with summary information
      const continuedContext = manager.buildContext({
        taskDescription: 'Continue authentication implementation',
        projectContext,
        enrichedContext: 'Updated codebase analysis with auth progress...',
      });

      expect(continuedContext.visualization.totalUsedTokens).toBeLessThanOrEqual(10000);
    });
  });
});