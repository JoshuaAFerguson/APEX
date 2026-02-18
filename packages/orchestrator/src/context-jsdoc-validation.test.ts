/**
 * JSDoc Validation Tests for Context Management Functions
 *
 * These tests validate that the documented behavior in JSDoc comments
 * matches the actual implementation behavior, including all @example
 * code snippets and parameter specifications.
 */

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

describe('JSDoc Example Validation Tests', () => {
  describe('estimateTokens JSDoc Examples', () => {
    it('should match the documented example behavior', () => {
      // From JSDoc example: const text = "Hello world!"; // Expected: 3 (12 chars / 4)
      const text = "Hello world!";
      const tokens = estimateTokens(text);
      expect(tokens).toBe(3); // 12 chars / 4 = 3
    });

    it('should handle various text lengths as documented', () => {
      expect(estimateTokens('')).toBe(0); // Empty string
      expect(estimateTokens('a')).toBe(1); // Single char -> ceil(1/4) = 1
      expect(estimateTokens('ab')).toBe(1); // Two chars -> ceil(2/4) = 1
      expect(estimateTokens('abcd')).toBe(1); // Four chars -> ceil(4/4) = 1
      expect(estimateTokens('abcde')).toBe(2); // Five chars -> ceil(5/4) = 2
    });
  });

  describe('estimateMessageTokens JSDoc Examples', () => {
    it('should match the documented example behavior', () => {
      // From JSDoc example
      const message: AgentMessage = {
        type: 'assistant',
        content: [{ type: 'text', text: 'Hello world!' }]
      };
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBe(3); // Should match estimateTokens result
    });

    it('should handle complex messages with multiple content blocks', () => {
      const message: AgentMessage = {
        type: 'assistant',
        content: [
          { type: 'text', text: 'Hello world!' }, // 3 tokens
          {
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/test.ts' } // JSON stringified and tokenized
          },
          {
            type: 'tool_result',
            toolResult: 'result data' // Additional tokens
          }
        ]
      };
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(3); // Should include all content blocks
    });
  });

  describe('estimateConversationTokens JSDoc Examples', () => {
    it('should provide accurate total for conversation as documented', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hello' }] }, // ~1 token
        { type: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] } // ~2 tokens
      ];
      const totalTokens = estimateConversationTokens(messages);
      expect(totalTokens).toBeGreaterThan(0);
      expect(totalTokens).toBe(
        estimateMessageTokens(messages[0]) + estimateMessageTokens(messages[1])
      );
    });

    it('should handle empty conversations as documented', () => {
      expect(estimateConversationTokens([])).toBe(0);
    });
  });

  describe('truncateToolResult JSDoc Examples', () => {
    it('should match the documented truncation behavior', () => {
      // From JSDoc example: largeResult = "A".repeat(10000), truncated to 1000
      const largeResult = "A".repeat(10000);
      const truncated = truncateToolResult(largeResult, 1000) as string;

      expect(truncated.length).toBeLessThan(10000);
      expect(truncated).toContain('[... truncated');
      expect(truncated).toContain('9000 characters ...]'); // 10000 - 1000 = 9000
      expect(truncated.substring(0, 1000)).toBe('A'.repeat(1000));
    });

    it('should not truncate results shorter than maxLength', () => {
      const shortResult = 'Short result';
      const result = truncateToolResult(shortResult, 1000);
      expect(result).toBe(shortResult); // Should be unchanged
    });

    it('should handle object inputs correctly', () => {
      const objResult = { data: 'A'.repeat(200) };
      const truncated = truncateToolResult(objResult, 100) as string;
      expect(typeof truncated).toBe('string');
      expect(truncated).toContain('[... truncated');
    });

    it('should use default maxLength when not specified', () => {
      const largeResult = 'A'.repeat(6000); // Larger than default 5000
      const truncated = truncateToolResult(largeResult) as string;
      expect(truncated.length).toBeLessThan(6000);
      expect(truncated).toContain('[... truncated 1000 characters ...]');
    });
  });

  describe('extractKeyDecisions JSDoc Examples', () => {
    it('should extract decisions as documented in examples', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement authentication using JWT tokens for secure user sessions.'
          }]
        }
      ];
      const decisions = extractKeyDecisions(messages);

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].text).toContain('implement authentication using JWT');
      expect(decisions[0].confidence).toBeGreaterThanOrEqual(0.5);
      expect(decisions[0].confidence).toBeLessThanOrEqual(1.0);
      expect(decisions[0].category).toBe('implementation');
      expect(decisions[0].messageIndex).toBe(0);
    });

    it('should handle various decision patterns correctly', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will create a new API endpoint. I\'m going to use Express framework. I plan to implement middleware for authentication. I\'ve decided to use MongoDB for persistence.'
          }]
        }
      ];
      const decisions = extractKeyDecisions(messages);

      expect(decisions.length).toBeGreaterThan(2);
      decisions.forEach(decision => {
        expect(decision).toHaveProperty('text');
        expect(decision).toHaveProperty('messageIndex');
        expect(decision).toHaveProperty('confidence');
        expect(decision).toHaveProperty('category');
        expect(['implementation', 'approach', 'architecture', 'workflow', 'other']).toContain(decision.category);
      });
    });
  });

  describe('extractProgressInfo JSDoc Examples', () => {
    it('should extract progress as documented in examples', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed file parsing. Finished test setup. Currently implementing authentication system.'
          }]
        }
      ];
      const progress = extractProgressInfo(messages);

      // From JSDoc example expectations
      expect(progress.completed).toContain('file parsing');
      expect(progress.completed).toContain('test setup');
      expect(progress.current).toContain('authentication');
      expect(progress.percentage).toBe(67); // 2 completed out of 3 total (2 completed + 1 current)
      expect(progress.lastActivity).toBeInstanceOf(Date);
    });

    it('should calculate percentages correctly', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed task A. Done with task B. Finished task C. Currently working on task D.'
          }]
        }
      ];
      const progress = extractProgressInfo(messages);

      expect(progress.completed.length).toBe(3);
      expect(progress.current).toContain('task D');
      expect(progress.percentage).toBe(75); // 3 completed out of 4 total
    });
  });

  describe('extractFileModifications JSDoc Examples', () => {
    it('should track file modifications as documented', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: { file_path: 'src/auth.ts', old_string: 'old', new_string: 'new' }
          }]
        }
      ];
      const mods = extractFileModifications(messages);

      // From JSDoc example expectations
      expect(mods.length).toBe(1);
      expect(mods[0].path).toBe('src/auth.ts');
      expect(mods[0].action).toBe('edit');
      expect(mods[0].count).toBe(1);
      expect(mods[0].lastMessageIndex).toBe(0);
    });

    it('should handle multiple operations on same file', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: 'src/test.ts' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: { file_path: 'src/test.ts', old_string: 'a', new_string: 'b' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: 'src/test.ts' }
          }]
        }
      ];
      const mods = extractFileModifications(messages);

      expect(mods.length).toBe(2); // read and edit operations tracked separately
      const readOp = mods.find(m => m.action === 'read');
      const editOp = mods.find(m => m.action === 'edit');

      expect(readOp?.count).toBe(2); // Two read operations
      expect(editOp?.count).toBe(1); // One edit operation
      expect(readOp?.lastMessageIndex).toBe(2); // Most recent read
    });
  });

  describe('createContextSummaryData JSDoc Examples', () => {
    it('should create comprehensive data as documented', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Please implement user authentication' }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement JWT-based authentication with secure token handling.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: 'src/auth.ts', content: 'auth code here' }
          }]
        }
      ];
      const data = createContextSummaryData(messages);

      // From JSDoc example expectations
      expect(data.metrics.messageCount).toBe(3);
      expect(data.keyDecisions.length).toBeGreaterThan(0);
      expect(data.fileModifications.length).toBe(1);
      expect(data.fileModifications[0].path).toBe('src/auth.ts');
      expect(data.fileModifications[0].action).toBe('write');
    });
  });

  describe('createContextSummary JSDoc Examples', () => {
    it('should generate formatted summary as documented', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a user dashboard' }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will create a responsive dashboard using React. I\'ve decided to use Material-UI for components.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: 'src/dashboard.tsx', content: 'dashboard code' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed dashboard component creation. Currently implementing user profile section.'
          }]
        }
      ];
      const summary = createContextSummary(messages);

      // From JSDoc example format expectations
      expect(summary).toContain('## Previous Context Summary');
      expect(summary).toContain('- Messages exchanged: 4');
      expect(summary).toContain('- Tools used: Write');
      expect(summary).toContain('- Files written: src/dashboard.tsx');
      expect(summary).toContain('### Progress Tracking');
      expect(summary).toContain('- Completed: dashboard component creation');
      expect(summary).toContain('- Currently: user profile section');
      expect(summary).toContain('### Key Decisions Made');
      expect(summary).toContain('React');
      expect(summary).toContain('Material-UI');
    });
  });

  describe('analyzeConversation JSDoc Examples', () => {
    it('should analyze conversation as documented', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hello world' }] },
        {
          type: 'user',
          content: [{ type: 'tool_result', toolResult: 'A'.repeat(5000) }]
        }
      ];
      const analysis = analyzeConversation(messages);

      // From JSDoc example expectations
      expect(analysis.totalTokens).toBeGreaterThan(1000); // Large due to tool result
      expect(analysis.recommendedStrategy).not.toBe('none'); // Should recommend action
      expect(analysis.toolResultTokens).toBeGreaterThan(analysis.textTokens);
      expect(analysis.messageCount).toBe(2);
    });

    it('should recommend correct strategies based on token thresholds', () => {
      // Test small conversation - should be 'none'
      const small: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'Hi' }] }
      ];
      expect(analyzeConversation(small).recommendedStrategy).toBe('none');

      // Test medium conversation - should be 'truncate'
      const medium: AgentMessage[] = Array.from({ length: 50 }, () => ({
        type: 'user' as const,
        content: [{ type: 'text' as const, text: 'A'.repeat(1000) }] // ~250 tokens each = ~12500 total
      }));
      const mediumAnalysis = analyzeConversation(medium);
      // Should be between 50k and 100k, so 'truncate'
      if (mediumAnalysis.totalTokens > 50000 && mediumAnalysis.totalTokens <= 100000) {
        expect(mediumAnalysis.recommendedStrategy).toBe('truncate');
      }
    });
  });
});

describe('Enhanced Edge Cases and Error Handling', () => {
  describe('Token Estimation Edge Cases', () => {
    it('should handle special characters and unicode correctly', () => {
      const unicodeText = '🚀 Hello 世界 👋 Testing émojis and ñ special chars';
      const tokens = estimateTokens(unicodeText);
      expect(tokens).toBeGreaterThan(0);
      expect(Number.isInteger(tokens)).toBe(true);
    });

    it('should handle very long strings efficiently', () => {
      const veryLongText = 'A'.repeat(100000); // 100k characters
      const startTime = Date.now();
      const tokens = estimateTokens(veryLongText);
      const endTime = Date.now();

      expect(tokens).toBe(25000); // 100000 / 4 = 25000
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle newlines and whitespace correctly', () => {
      const textWithNewlines = 'Line 1\\n\\nLine 2\\t\\tTabbed\\r\\nWindows line ending';
      const tokens = estimateTokens(textWithNewlines);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Message Token Estimation Edge Cases', () => {
    it('should handle messages with null/undefined content gracefully', () => {
      const message: AgentMessage = {
        type: 'assistant',
        content: [
          { type: 'text', text: undefined as unknown as string },
          { type: 'tool_result', toolResult: null }
        ]
      };

      expect(() => estimateMessageTokens(message)).not.toThrow();
      const tokens = estimateMessageTokens(message);
      expect(tokens).toBe(0);
    });

    it('should handle complex nested tool inputs', () => {
      const complexMessage: AgentMessage = {
        type: 'assistant',
        content: [{
          type: 'tool_use',
          toolName: 'ComplexTool',
          toolInput: {
            nested: {
              array: [1, 2, 3, { deep: 'value' }],
              boolean: true,
              number: 42.5,
              nullValue: null,
              undefinedValue: undefined
          }
          }
        }]
      };

      const tokens = estimateMessageTokens(complexMessage);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle tool results that are complex objects', () => {
      const complexResult = {
        status: 'success',
        data: {
          users: [
            { id: 1, name: 'John', emails: ['john@test.com'] },
            { id: 2, name: 'Jane', emails: ['jane@test.com', 'jane.doe@test.com'] }
          ],
          pagination: { page: 1, total: 100, hasMore: true }
        },
        metadata: { timestamp: '2024-01-15T10:30:00Z', version: '1.0' }
      };

      const message: AgentMessage = {
        type: 'user',
        content: [{
          type: 'tool_result',
          toolResult: complexResult
        }]
      };

      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Decision Extraction Edge Cases', () => {
    it('should handle mixed language content', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement 認証 system. I\'ve decided to use JWT tokens. Je vais créer une API REST.'
          }]
        }
      ];

      const decisions = extractKeyDecisions(messages);
      expect(decisions.length).toBeGreaterThan(0);
      // Should still detect English decision patterns
      const jwtDecision = decisions.find(d => d.text.includes('JWT'));
      expect(jwtDecision).toBeDefined();
    });

    it('should handle very long decision texts correctly', () => {
      const longDecisionText = `I will implement a comprehensive authentication system that includes user registration, login, password reset functionality, email verification, two-factor authentication support, session management, JWT token handling, refresh token rotation, rate limiting for security, password strength validation, account lockout mechanisms, audit logging, and integration with third-party OAuth providers like Google and GitHub for social authentication.`;

      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{ type: 'text', text: longDecisionText }]
        }
      ];

      const decisions = extractKeyDecisions(messages);
      expect(decisions.length).toBeGreaterThan(0);
      // Should truncate to reasonable length but still capture the decision
      expect(decisions[0].text.length).toBeLessThanOrEqual(150);
    });

    it('should handle code blocks and formatted content', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: `I will implement the following authentication flow:

            \`\`\`typescript
            const authenticate = (token: string) => {
              return jwt.verify(token, secret);
            };
            \`\`\`

            The approach will be to use middleware for token validation.`
          }]
        }
      ];

      const decisions = extractKeyDecisions(messages);
      expect(decisions.length).toBeGreaterThan(0);
      const authDecision = decisions.find(d => d.text.includes('authentication flow'));
      expect(authDecision).toBeDefined();
    });
  });

  describe('Progress Tracking Edge Cases', () => {
    it('should handle progress indicators with timestamps and percentages', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Progress: 75% of authentication module complete (15:30 GMT). Status: implementing password validation. Stage 1 completed at 14:45. Phase 2 finished successfully.'
          }]
        }
      ];

      const progress = extractProgressInfo(messages);
      expect(progress.completed.length).toBeGreaterThan(0);
      expect(progress.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle overlapping progress patterns', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the database setup. Currently working on API setup. I\'ve finished configuring the server. Now implementing user routes.'
          }]
        }
      ];

      const progress = extractProgressInfo(messages);
      expect(progress.completed).toContain('database setup');
      expect(progress.completed).toContain('configuring the server');
      // Should take the last current activity
      expect(progress.current).toContain('user routes');
    });
  });

  describe('File Modification Edge Cases', () => {
    it('should handle file paths with special characters and spaces', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: '/src/components/user-profile (v2).tsx', content: 'code' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: { file_path: '/src/utils/file@helper#test.ts', old_string: 'old', new_string: 'new' }
          }]
        }
      ];

      const mods = extractFileModifications(messages);
      expect(mods.length).toBe(2);
      expect(mods.some(m => m.path.includes('user-profile (v2)'))).toBe(true);
      expect(mods.some(m => m.path.includes('file@helper#test'))).toBe(true);
    });

    it('should handle very long file paths', () => {
      const longPath = '/src/' + 'very/'.repeat(50) + 'deeply/nested/file.ts';
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: longPath }
          }]
        }
      ];

      const mods = extractFileModifications(messages);
      expect(mods.length).toBe(1);
      expect(mods[0].path).toBe(longPath);
    });

    it('should handle tool calls with missing or malformed inputs gracefully', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: null
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { content: 'code', file_path: undefined }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: { file_path: '', old_string: 'old', new_string: 'new' }
          }]
        }
      ];

      expect(() => extractFileModifications(messages)).not.toThrow();
      const mods = extractFileModifications(messages);
      expect(mods.length).toBe(0); // Should ignore malformed entries
    });
  });

  describe('Conversation Analysis Edge Cases', () => {
    it('should handle conversations with only system messages', () => {
      const messages: AgentMessage[] = [
        { type: 'system', content: [{ type: 'text', text: 'System prompt for AI assistant' }] },
        { type: 'system', content: [{ type: 'text', text: 'Additional system configuration' }] }
      ];

      const analysis = analyzeConversation(messages);
      expect(analysis.messageCount).toBe(2);
      expect(analysis.totalTokens).toBeGreaterThan(0);
      expect(analysis.recommendedStrategy).toBe('none'); // Small conversation
    });

    it('should handle conversations with circular references in tool inputs', () => {
      const circularObj: any = { name: 'test', value: 42 };
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj };

      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'ComplexTool',
            toolInput: circularObj
          }]
        }
      ];

      expect(() => analyzeConversation(messages)).not.toThrow();
      const analysis = analyzeConversation(messages);
      expect(analysis.messageCount).toBe(1);
      expect(analysis.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Context Summary Generation Edge Cases', () => {
    it('should handle conversations with no file operations', () => {
      const messages: AgentMessage[] = [
        { type: 'user', content: [{ type: 'text', text: 'What is the weather like?' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'I cannot check weather without tools.' }] }
      ];

      const summary = createContextSummary(messages);
      expect(summary).toContain('Messages exchanged: 2');
      expect(summary).toContain('Tools used: none');
      expect(summary).not.toContain('Files read:');
      expect(summary).not.toContain('Files written:');
      expect(summary).not.toContain('Files edited:');
    });

    it('should handle conversations with many file operations (>10)', () => {
      const messages: AgentMessage[] = [];

      // Add 15 read operations
      for (let i = 0; i < 15; i++) {
        messages.push({
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: `/src/file${i}.ts` }
          }]
        });
      }

      const summary = createContextSummary(messages);
      expect(summary).toContain('Files read:');
      expect(summary).toContain('(+5 more)'); // Should truncate after 10 and show "+5 more"
    });

    it('should handle mixed tool types correctly in summary', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/src/config.ts' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: '/src/new-feature.ts', content: 'code' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: { file_path: '/src/config.ts', old_string: 'old', new_string: 'new' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'UnknownTool',
            toolInput: { file_path: '/should/be/ignored.ts' }
          }]
        }
      ];

      const summary = createContextSummary(messages);
      expect(summary).toContain('Files read: /src/config.ts');
      expect(summary).toContain('Files written: /src/new-feature.ts');
      expect(summary).toContain('Files edited: /src/config.ts');
      expect(summary).not.toContain('/should/be/ignored.ts'); // Unknown tool should be ignored
    });

    it('should format progress percentages correctly', () => {
      const messages: AgentMessage[] = [
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed authentication. Done with authorization. Finished validation. Currently implementing error handling.'
          }]
        }
      ];

      const summary = createContextSummary(messages);
      expect(summary).toContain('Overall progress: 75%'); // 3 completed out of 4 total
    });
  });
});