import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
  truncateToolResult,
  summarizeMessage,
  compactConversation,
  pruneToolResults,
  createContextSummary,
  analyzeConversation,
} from './context';
import type { AgentMessage } from '@apex/core';

describe('Context Compaction', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for a string', () => {
      const text = 'Hello, world!'; // 13 chars
      const tokens = estimateTokens(text);
      expect(tokens).toBe(4); // ceil(13/4) = 4
    });

    it('should handle empty strings', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle long strings', () => {
      const text = 'a'.repeat(1000);
      expect(estimateTokens(text)).toBe(250);
    });
  });

  describe('estimateMessageTokens', () => {
    it('should estimate tokens for a text message', () => {
      const message: AgentMessage = {
        type: 'assistant',
        content: [{ type: 'text', text: 'Hello, this is a test message.' }],
      };
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for tool use', () => {
      const message: AgentMessage = {
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/path/to/file.ts' },
          },
        ],
      };
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for tool result', () => {
      const message: AgentMessage = {
        type: 'user',
        content: [
          {
            type: 'tool_result',
            toolResult: 'File contents here...',
          },
        ],
      };
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateConversationTokens', () => {
    it('should sum tokens for all messages', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
      ];
      const total = estimateConversationTokens(messages);
      expect(total).toBeGreaterThan(0);
    });

    it('should return 0 for empty conversation', () => {
      expect(estimateConversationTokens([])).toBe(0);
    });
  });

  describe('truncateToolResult', () => {
    it('should not truncate short results', () => {
      const result = 'Short result';
      const truncated = truncateToolResult(result, 100);
      expect(truncated).toBe(result);
    });

    it('should truncate long string results', () => {
      const result = 'a'.repeat(200);
      const truncated = truncateToolResult(result, 100) as string;
      expect(truncated.length).toBeLessThan(200);
      expect(truncated).toContain('truncated');
    });

    it('should handle object results', () => {
      const result = { data: 'a'.repeat(200) };
      const truncated = truncateToolResult(result, 100) as string;
      expect(truncated).toContain('truncated');
    });
  });

  describe('summarizeMessage', () => {
    it('should summarize text messages', () => {
      const message: AgentMessage = {
        type: 'assistant',
        content: [{ type: 'text', text: 'a'.repeat(500) }],
      };
      const summarized = summarizeMessage(message);
      expect(summarized.content[0].text).toContain('[Summary]');
      expect(summarized.content[0].text!.length).toBeLessThan(300);
    });

    it('should summarize tool use', () => {
      const message: AgentMessage = {
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/very/long/path/to/file.ts' },
          },
        ],
      };
      const summarized = summarizeMessage(message);
      expect(summarized.content[0].toolName).toBe('Read');
      expect((summarized.content[0].toolInput as Record<string, unknown>)._summarized).toBe(true);
    });

    it('should summarize tool results', () => {
      const message: AgentMessage = {
        type: 'user',
        content: [
          {
            type: 'tool_result',
            toolResult: 'Very long file contents...',
          },
        ],
      };
      const summarized = summarizeMessage(message);
      expect(summarized.content[0].toolResult).toBe('[Result omitted for brevity]');
    });
  });

  describe('compactConversation', () => {
    it('should keep recent messages intact', () => {
      const messages: AgentMessage[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'user',
        content: [{ type: 'text', text: `Message ${i}` }],
      }));

      const compacted = compactConversation(messages, { maxRecentMessages: 10 });
      expect(compacted.length).toBe(5);
      expect(compacted[4].content[0].text).toBe('Message 4');
    });

    it('should summarize older messages when option enabled', () => {
      const messages: AgentMessage[] = Array.from({ length: 15 }, (_, i) => ({
        type: 'user',
        content: [{ type: 'text', text: `Message ${i} with some content` }],
      }));

      const compacted = compactConversation(messages, {
        maxRecentMessages: 5,
        summarizeOlder: true,
      });

      // First 10 should be summarized, last 5 kept intact
      expect(compacted.length).toBe(15);
      expect(compacted[0].content[0].text).toContain('[Summary]');
      expect(compacted[14].content[0].text).toBe('Message 14 with some content');
    });

    it('should preserve system messages', () => {
      const messages: AgentMessage[] = [
        { type: 'system', content: [{ type: 'text', text: 'System prompt' }] },
        { type: 'user', content: [{ type: 'text', text: 'User message' }] },
      ];

      const compacted = compactConversation(messages);
      expect(compacted[0].type).toBe('system');
    });

    it('should truncate tool results in recent messages', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'tool_result', toolResult: 'a'.repeat(10000) }],
        },
      ];

      const compacted = compactConversation(messages, { maxToolResultLength: 100 });
      const result = compacted[0].content[0].toolResult as string;
      expect(result.length).toBeLessThan(10000);
    });

    it('should handle empty conversation', () => {
      const compacted = compactConversation([]);
      expect(compacted).toEqual([]);
    });
  });

  describe('pruneToolResults', () => {
    it('should keep last N tool results intact', () => {
      const messages: AgentMessage[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'user',
        content: [{ type: 'tool_result', toolResult: `Result ${i}` }],
      }));

      const pruned = pruneToolResults(messages, 3);

      // First 7 should be pruned
      expect(pruned[0].content[0].toolResult).toBe('[Result pruned for context management]');
      expect(pruned[6].content[0].toolResult).toBe('[Result pruned for context management]');

      // Last 3 should be intact
      expect(pruned[7].content[0].toolResult).toBe('Result 7');
      expect(pruned[8].content[0].toolResult).toBe('Result 8');
      expect(pruned[9].content[0].toolResult).toBe('Result 9');
    });

    it('should handle messages without tool results', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
      ];

      const pruned = pruneToolResults(messages, 5);
      expect(pruned).toEqual(messages);
    });
  });

  describe('createContextSummary', () => {
    it('should create a summary of the conversation', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Please read the file' }] },
        {
          type: 'assistant',
          content: [{ type: 'tool_use', toolName: 'Read', toolInput: { file_path: '/src/index.ts' } }],
        },
        { type: 'user', content: [{ type: 'tool_result', toolResult: 'File contents' }] },
        {
          type: 'assistant',
          content: [
            { type: 'tool_use', toolName: 'Edit', toolInput: { file_path: '/src/index.ts', old_string: 'a', new_string: 'b' } },
          ],
        },
      ];

      const summary = createContextSummary(messages);

      expect(summary).toContain('Previous Context Summary');
      expect(summary).toContain('Messages exchanged: 4');
      expect(summary).toContain('Read');
      expect(summary).toContain('Edit');
      expect(summary).toContain('/src/index.ts');
    });

    it('should handle empty conversation', () => {
      const summary = createContextSummary([]);
      expect(summary).toContain('Messages exchanged: 0');
    });
  });

  describe('analyzeConversation', () => {
    it('should analyze token distribution', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hello' }] },
        {
          type: 'user',
          content: [{ type: 'tool_result', toolResult: 'a'.repeat(1000) }],
        },
      ];

      const analysis = analyzeConversation(messages);

      expect(analysis.messageCount).toBe(2);
      expect(analysis.totalTokens).toBeGreaterThan(0);
      expect(analysis.toolResultTokens).toBeGreaterThan(analysis.textTokens);
    });

    it('should recommend strategy based on token count', () => {
      // Small conversation
      const small: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ];
      expect(analyzeConversation(small).recommendedStrategy).toBe('none');

      // Large conversation (simulate with repeated content)
      // 200 messages * 4000 chars / 4 = 200000 tokens - should trigger aggressive
      const large: AgentMessage[] = Array.from({ length: 200 }, () => ({
        type: 'user',
        content: [{ type: 'text', text: 'a'.repeat(4000) }],
      }));
      const analysis = analyzeConversation(large);
      // Should recommend something other than 'none' for large conversations
      expect(analysis.recommendedStrategy).not.toBe('none');
      expect(['truncate', 'summarize', 'aggressive']).toContain(analysis.recommendedStrategy);
    });
  });
});
