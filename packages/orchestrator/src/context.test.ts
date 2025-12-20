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
  createContextSummaryData,
  extractKeyDecisions,
  extractProgressInfo,
  extractFileModifications,
  analyzeConversation,
} from './context';
import type { AgentMessage } from '@apexcli/core';

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

    it('should include enhanced tracking features', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Please implement authentication feature' }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement JWT-based authentication. I\'ve decided to use bcrypt for password hashing.'
          }],
        },
        {
          type: 'assistant',
          content: [{ type: 'tool_use', toolName: 'Write', toolInput: { file_path: '/src/auth.ts', content: 'code here' } }],
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the authentication module implementation. Currently working on user registration.'
          }],
        },
      ];

      const summary = createContextSummary(messages);

      expect(summary).toContain('Previous Context Summary');
      expect(summary).toContain('Key Decisions Made');
      expect(summary).toContain('JWT-based authentication');
      expect(summary).toContain('Progress Tracking');
      expect(summary).toContain('authentication module implementation');
      expect(summary).toContain('Files written: /src/auth.ts');
    });
  });

  describe('Enhanced Context Functions', () => {
    describe('extractKeyDecisions', () => {
      it('should extract decisions from assistant messages', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement a REST API using Express.js. I\'ve decided to use TypeScript for better type safety.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'The user wants me to help. I plan to create modular components for better maintainability.'
            }],
          },
        ];

        const decisions = extractKeyDecisions(messages);

        expect(decisions.length).toBeGreaterThan(0);
        expect(decisions[0]).toMatchObject({
          text: expect.stringContaining('REST API'),
          messageIndex: 0,
          confidence: expect.any(Number),
          category: 'implementation'
        });
      });

      it('should handle empty messages', () => {
        const decisions = extractKeyDecisions([]);
        expect(decisions).toEqual([]);
      });

      it('should filter out very short matches', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{ type: 'text', text: 'I will do it.' }],
          },
        ];

        const decisions = extractKeyDecisions(messages);
        expect(decisions.length).toBe(0);
      });

      it('should detect different categories of decisions correctly', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement the authentication system using JWT tokens. The approach will be to store tokens in HTTP-only cookies for security.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I\'ve decided to choose PostgreSQL over MongoDB. The architecture will be microservices-based for scalability.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'The workflow should include automated testing and CI/CD deployment. I think we should use GitHub Actions for this.'
            }],
          },
        ];

        const decisions = extractKeyDecisions(messages);

        expect(decisions.length).toBeGreaterThan(4);

        const implementationDecisions = decisions.filter(d => d.category === 'implementation');
        const approachDecisions = decisions.filter(d => d.category === 'approach');
        const architectureDecisions = decisions.filter(d => d.category === 'architecture');
        const workflowDecisions = decisions.filter(d => d.category === 'workflow');

        expect(implementationDecisions.length).toBeGreaterThan(0);
        expect(approachDecisions.length).toBeGreaterThan(0);
        expect(architectureDecisions.length).toBeGreaterThan(0);
        expect(workflowDecisions.length).toBeGreaterThan(0);
      });

      it('should handle decisions with confidence scoring', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement this feature. I\'m going to use React hooks. I believe we should also consider TypeScript.'
            }],
          },
        ];

        const decisions = extractKeyDecisions(messages);

        expect(decisions.length).toBeGreaterThan(0);
        expect(decisions[0].confidence).toBeGreaterThanOrEqual(0.5);
        expect(decisions[0].confidence).toBeLessThanOrEqual(1.0);

        // High confidence decisions should come first
        for (let i = 0; i < decisions.length - 1; i++) {
          expect(decisions[i].confidence).toBeGreaterThanOrEqual(decisions[i + 1].confidence);
        }
      });

      it('should remove duplicate decisions', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement authentication using JWT tokens for secure user sessions.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement Authentication using JWT tokens for secure user sessions.'
            }],
          },
        ];

        const decisions = extractKeyDecisions(messages);

        // Should have only one decision due to deduplication (case-insensitive)
        expect(decisions.length).toBe(1);
      });

      it('should limit to top 10 decisions', () => {
        const messages: AgentMessage[] = Array.from({ length: 20 }, (_, i) => ({
          type: 'assistant',
          content: [{
            type: 'text',
            text: `I will implement feature number ${i} using a different approach for maximum efficiency.`
          }],
        }));

        const decisions = extractKeyDecisions(messages);
        expect(decisions.length).toBeLessThanOrEqual(10);
      });

      it('should only process assistant messages for decisions', () => {
        const messages: AgentMessage[] = [
          {
            type: 'user',
            content: [{
              type: 'text',
              text: 'I will implement this myself. I\'ve decided to use React.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will help you implement this using Vue.js instead.'
            }],
          },
        ];

        const decisions = extractKeyDecisions(messages);

        expect(decisions.length).toBe(1);
        expect(decisions[0].text).toContain('Vue.js');
      });
    });

    describe('extractProgressInfo', () => {
      it('should extract progress indicators', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed the database setup. Finished configuring authentication middleware.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Currently working on implementing the user registration endpoint.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.completed).toContain('database setup');
        expect(progress.completed).toContain('configuring authentication middleware');
        expect(progress.current).toContain('user registration endpoint');
        expect(progress.percentage).toBeGreaterThan(0);
      });

      it('should handle empty progress', () => {
        const progress = extractProgressInfo([]);
        expect(progress).toMatchObject({
          completed: [],
          current: undefined,
          percentage: 0,
          lastActivity: undefined
        });
      });

      it('should calculate progress percentage correctly', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed task A. Done with task B. Finished implementing feature C.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Currently working on task D.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.completed.length).toBe(3);
        expect(progress.current).toBeDefined();
        // 3 completed out of 4 total (3 completed + 1 current) = 75%
        expect(progress.percentage).toBe(75);
      });

      it('should handle multiple current activities and take the last one', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Currently working on authentication. Now implementing user management.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.current).toContain('user management');
      });

      it('should avoid duplicate completed items', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed the database setup. Finished the database setup again.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.completed).toEqual(['the database setup']);
        expect(progress.completed.length).toBe(1);
      });

      it('should set lastActivity when progress is detected', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed the initial setup phase.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.lastActivity).toBeInstanceOf(Date);
        expect(progress.lastActivity!.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('should handle progress status indicators', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Progress: 50% of authentication module complete. Status: implementing login flow.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.completed.length + (progress.current ? 1 : 0)).toBeGreaterThan(0);
      });

      it('should handle stages and phases completion', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Stage 1 completed successfully. Phase 2 finished. Step 3 done.'
            }],
          },
        ];

        const progress = extractProgressInfo(messages);

        expect(progress.completed.length).toBeGreaterThan(0);
      });
    });

    describe('extractFileModifications', () => {
      it('should track file operations with action types', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/config.ts' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Edit',
              toolInput: { file_path: '/src/config.ts', old_string: 'old', new_string: 'new' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/auth.ts', content: 'code' }
            }],
          },
        ];

        const modifications = extractFileModifications(messages);

        expect(modifications.length).toBe(3);

        const readOp = modifications.find(m => m.action === 'read');
        expect(readOp).toMatchObject({
          path: '/src/config.ts',
          action: 'read',
          count: 1,
          lastMessageIndex: 0
        });

        const editOp = modifications.find(m => m.action === 'edit');
        expect(editOp).toMatchObject({
          path: '/src/config.ts',
          action: 'edit',
          count: 1,
          lastMessageIndex: 1
        });

        const writeOp = modifications.find(m => m.action === 'write');
        expect(writeOp).toMatchObject({
          path: '/src/auth.ts',
          action: 'write',
          count: 1,
          lastMessageIndex: 2
        });
      });

      it('should count repeated operations', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/test.ts' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/test.ts' }
            }],
          },
        ];

        const modifications = extractFileModifications(messages);

        expect(modifications.length).toBe(1);
        expect(modifications[0].count).toBe(2);
        expect(modifications[0].lastMessageIndex).toBe(1);
      });

      it('should handle empty messages', () => {
        const modifications = extractFileModifications([]);
        expect(modifications).toEqual([]);
      });

      it('should ignore unknown tool types', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'UnknownTool',
              toolInput: { file_path: '/src/test.ts' }
            }],
          },
        ];

        const modifications = extractFileModifications(messages);
        expect(modifications).toEqual([]);
      });

      it('should handle tool calls without file_path', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { content: 'some content without file path' }
            }],
          },
        ];

        const modifications = extractFileModifications(messages);
        expect(modifications).toEqual([]);
      });

      it('should sort by most recent modification first', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/old.ts' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/new.ts', content: 'code' }
            }],
          },
        ];

        const modifications = extractFileModifications(messages);

        expect(modifications.length).toBe(2);
        expect(modifications[0].path).toBe('/src/new.ts'); // Most recent first
        expect(modifications[1].path).toBe('/src/old.ts');
      });

      it('should track different actions on same file separately', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/config.ts' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Edit',
              toolInput: { file_path: '/src/config.ts', old_string: 'old', new_string: 'new' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/config.ts' }
            }],
          },
        ];

        const modifications = extractFileModifications(messages);

        expect(modifications.length).toBe(2);

        const readOp = modifications.find(m => m.action === 'read');
        const editOp = modifications.find(m => m.action === 'edit');

        expect(readOp!.count).toBe(2); // Two read operations
        expect(editOp!.count).toBe(1); // One edit operation
        expect(readOp!.lastMessageIndex).toBe(2); // Most recent read
        expect(editOp!.lastMessageIndex).toBe(1); // Edit operation
      });
    });

    describe('createContextSummaryData', () => {
      it('should create comprehensive structured summary', () => {
        const messages: AgentMessage[] = [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Please create a new API endpoint' }]
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will create a RESTful endpoint using Express.js framework.'
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/routes/api.ts', content: 'code' }
            }],
          },
        ];

        const data = createContextSummaryData(messages);

        expect(data).toMatchObject({
          metrics: {
            messageCount: 3,
            userRequestCount: 1,
            toolUsageCount: 1
          },
          keyDecisions: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('RESTful endpoint'),
              category: 'implementation'
            })
          ]),
          progress: expect.objectContaining({
            completed: expect.any(Array),
            percentage: expect.any(Number)
          }),
          fileModifications: expect.arrayContaining([
            expect.objectContaining({
              path: '/src/routes/api.ts',
              action: 'write',
              count: 1
            })
          ]),
          toolsUsed: { 'Write': 1 },
          recentRequests: expect.arrayContaining([
            'Please create a new API endpoint'
          ])
        });
      });
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

  describe('Integration Tests', () => {
    describe('Complex Conversation Scenarios', () => {
      it('should handle a complete development workflow conversation', () => {
        const messages: AgentMessage[] = [
          // User request
          {
            type: 'user',
            content: [{ type: 'text', text: 'Please implement a user authentication system with JWT tokens' }]
          },
          // Planning phase
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement a comprehensive authentication system. I\'ve decided to use JWT tokens with bcrypt for password hashing. The approach will be to create middleware for token validation.'
            }],
          },
          // Implementation phase - reading existing files
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/src/app.ts' }
            }],
          },
          {
            type: 'user',
            content: [{
              type: 'tool_result',
              toolResult: 'export const app = express();'
            }],
          },
          // Creating new files
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/auth/middleware.ts', content: 'export const authMiddleware = ...' }
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/auth/routes.ts', content: 'export const authRoutes = ...' }
            }],
          },
          // Progress updates
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Completed the authentication middleware implementation. Finished creating auth routes. Currently working on implementing password validation.'
            }],
          },
          // More implementation
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Edit',
              toolInput: { file_path: '/src/app.ts', old_string: 'export const app = express();', new_string: 'import { authRoutes } from "./auth/routes";\nexport const app = express();\napp.use("/auth", authRoutes);' }
            }],
          },
          // Final updates
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'Implementation completed successfully. The authentication system now supports JWT token generation and validation.'
            }],
          },
        ];

        const summaryData = createContextSummaryData(messages);

        // Test comprehensive data extraction
        expect(summaryData.metrics.messageCount).toBe(9);
        expect(summaryData.metrics.userRequestCount).toBe(1);
        expect(summaryData.metrics.toolUsageCount).toBe(4);

        // Test decision extraction
        expect(summaryData.keyDecisions.length).toBeGreaterThan(0);
        const jwtDecision = summaryData.keyDecisions.find(d => d.text.includes('JWT tokens'));
        expect(jwtDecision).toBeDefined();
        expect(jwtDecision!.category).toBe('implementation');

        // Test progress tracking
        expect(summaryData.progress.completed).toContain('authentication middleware implementation');
        expect(summaryData.progress.completed).toContain('creating auth routes');
        expect(summaryData.progress.current).toContain('password validation');

        // Test file modifications
        expect(summaryData.fileModifications.length).toBe(4);
        const readOps = summaryData.fileModifications.filter(f => f.action === 'read');
        const writeOps = summaryData.fileModifications.filter(f => f.action === 'write');
        const editOps = summaryData.fileModifications.filter(f => f.action === 'edit');

        expect(readOps.length).toBe(1);
        expect(writeOps.length).toBe(2);
        expect(editOps.length).toBe(1);

        // Test tools usage
        expect(summaryData.toolsUsed).toEqual({ 'Read': 1, 'Write': 2, 'Edit': 1 });

        // Test recent requests
        expect(summaryData.recentRequests).toContain('Please implement a user authentication system with JWT tokens');
      });

      it('should handle malformed conversation data gracefully', () => {
        const messages: AgentMessage[] = [
          // Message with missing text
          {
            type: 'assistant',
            content: [{ type: 'text', text: undefined }],
          },
          // Tool use with missing input
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: undefined
            }],
          },
          // Empty content blocks
          {
            type: 'user',
            content: [],
          },
          // Valid message mixed in
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will implement this feature correctly despite the malformed data.'
            }],
          },
        ];

        const summaryData = createContextSummaryData(messages);

        // Should not crash and should extract what it can
        expect(summaryData.metrics.messageCount).toBe(4);
        expect(summaryData.keyDecisions.length).toBe(1);
        expect(summaryData.keyDecisions[0].text).toContain('implement this feature');
        expect(summaryData.fileModifications).toEqual([]);
        expect(summaryData.toolsUsed).toEqual({});
      });
    });

    describe('Performance Tests', () => {
      it('should handle large conversations efficiently', () => {
        const startTime = Date.now();

        // Create a large conversation with 1000 messages
        const messages: AgentMessage[] = Array.from({ length: 1000 }, (_, i) => ({
          type: i % 2 === 0 ? 'user' : 'assistant',
          content: [{
            type: 'text',
            text: `Message ${i}: I will implement feature ${i} using approach ${i % 5}. Completed task ${i - 1}. Currently working on task ${i}.`
          }],
        }));

        // Add some file operations
        for (let i = 0; i < 100; i++) {
          messages.push({
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: i % 3 === 0 ? 'Read' : i % 3 === 1 ? 'Write' : 'Edit',
              toolInput: { file_path: `/src/file${i}.ts` }
            }],
          });
        }

        const summaryData = createContextSummaryData(messages);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within reasonable time (less than 1 second for 1100 messages)
        expect(duration).toBeLessThan(1000);

        // Should extract correct metrics
        expect(summaryData.metrics.messageCount).toBe(1100);
        expect(summaryData.keyDecisions.length).toBeLessThanOrEqual(10); // Limited to top 10
        expect(summaryData.progress.completed.length).toBeGreaterThan(0);
        expect(summaryData.fileModifications.length).toBe(100);
        expect(summaryData.toolsUsed['Read']).toBeGreaterThan(0);
        expect(summaryData.toolsUsed['Write']).toBeGreaterThan(0);
        expect(summaryData.toolsUsed['Edit']).toBeGreaterThan(0);
      });

      it('should handle conversations with large file operations', () => {
        const largeFileContent = 'x'.repeat(100000); // 100KB of content

        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Write',
              toolInput: { file_path: '/src/large-file.ts', content: largeFileContent }
            }],
          },
          {
            type: 'user',
            content: [{
              type: 'tool_result',
              toolResult: largeFileContent
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: 'I will process this large file efficiently. I\'ve decided to optimize the file handling.'
            }],
          },
        ];

        const startTime = Date.now();
        const summaryData = createContextSummaryData(messages);
        const endTime = Date.now();

        // Should complete quickly even with large content
        expect(endTime - startTime).toBeLessThan(500);

        // Should extract data correctly
        expect(summaryData.fileModifications.length).toBe(1);
        expect(summaryData.fileModifications[0].path).toBe('/src/large-file.ts');
        expect(summaryData.keyDecisions.length).toBe(2);
      });
    });

    describe('Error Handling', () => {
      it('should handle null and undefined values gracefully', () => {
        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: null as unknown as string
            }],
          },
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: null as unknown as string,
              toolInput: null
            }],
          },
        ];

        expect(() => createContextSummaryData(messages)).not.toThrow();
        const summaryData = createContextSummaryData(messages);
        expect(summaryData.keyDecisions).toEqual([]);
        expect(summaryData.fileModifications).toEqual([]);
      });

      it('should handle circular references in tool inputs', () => {
        const circularObj: any = { name: 'test' };
        circularObj.self = circularObj;

        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'tool_use',
              toolName: 'Read',
              toolInput: circularObj
            }],
          },
        ];

        expect(() => createContextSummaryData(messages)).not.toThrow();
      });

      it('should handle extremely long text content', () => {
        const extremelyLongText = 'a'.repeat(1000000); // 1MB of text

        const messages: AgentMessage[] = [
          {
            type: 'assistant',
            content: [{
              type: 'text',
              text: `I will implement this feature. ${extremelyLongText} This is a decision.`
            }],
          },
        ];

        const startTime = Date.now();
        const summaryData = createContextSummaryData(messages);
        const endTime = Date.now();

        // Should handle large text without hanging
        expect(endTime - startTime).toBeLessThan(5000);
        expect(summaryData.keyDecisions.length).toBeGreaterThan(0);
      });
    });
  });
});
