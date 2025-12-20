import { estimateConversationTokens } from './context';
import { ApexOrchestrator } from './index';
import type { AgentMessage } from '@apexcli/core';

describe('Session Limit Detection - Integration Tests', () => {
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    orchestrator = new ApexOrchestrator({ debug: false });
    await orchestrator.init();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
  });

  describe('estimateConversationTokens integration', () => {
    it('should correctly estimate tokens for various message types', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Hello world' }],
        },
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Hi there!' },
            {
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/path/to/file.ts' },
            },
          ],
        },
        {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: 'export function hello() { return "world"; }',
            },
          ],
        },
      ];

      const tokenCount = estimateConversationTokens(messages);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(100); // Reasonable estimate for short conversation
    });

    it('should estimate tokens for complex tool results', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: {
                files: ['file1.ts', 'file2.ts', 'file3.ts'],
                results: {
                  file1: { lines: 100, functions: 5 },
                  file2: { lines: 200, functions: 10 },
                  file3: { lines: 50, functions: 2 },
                },
                metadata: {
                  totalFiles: 3,
                  totalLines: 350,
                  totalFunctions: 17,
                },
              },
            },
          ],
        },
      ];

      const tokenCount = estimateConversationTokens(messages);

      expect(tokenCount).toBeGreaterThan(50); // Complex object should have meaningful token count
    });

    it('should handle empty conversation gracefully', () => {
      const messages: AgentMessage[] = [];
      const tokenCount = estimateConversationTokens(messages);

      expect(tokenCount).toBe(0);
    });

    it('should accurately reflect token counts in session limit detection', async () => {
      // Create test messages with known content
      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'x'.repeat(1000) }], // ~250 tokens
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'y'.repeat(2000) }], // ~500 tokens
        },
      ];

      const expectedTokens = estimateConversationTokens(conversation);

      const task = await orchestrator.createTask({
        description: 'Token accuracy test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      // The session limit detection should use the same token estimation
      expect(status.currentTokens).toBe(expectedTokens);
    });
  });

  describe('session limit thresholds accuracy', () => {
    it('should correctly categorize utilization levels', async () => {
      const contextWindow = 10000;

      // Test each threshold boundary
      const testCases = [
        { chars: 2000, expectedRecommendation: 'continue' }, // ~500 tokens, 5% utilization
        { chars: 6000, expectedRecommendation: 'continue' }, // ~1500 tokens, 15% utilization
        { chars: 25000, expectedRecommendation: 'summarize' }, // ~6250 tokens, 62.5% utilization
        { chars: 34000, expectedRecommendation: 'checkpoint' }, // ~8500 tokens, 85% utilization
        { chars: 38000, expectedRecommendation: 'handoff' }, // ~9500 tokens, 95% utilization
      ];

      for (const testCase of testCases) {
        const task = await orchestrator.createTask({
          description: `Threshold test: ${testCase.expectedRecommendation}`,
          conversation: [
            {
              type: 'user',
              content: [{ type: 'text', text: 'x'.repeat(testCase.chars) }],
            },
          ],
        });

        const status = await orchestrator.detectSessionLimit(task.id, contextWindow);

        expect(status.recommendation).toBe(testCase.expectedRecommendation);
      }
    });

    it('should respect custom contextWindowThreshold configuration', async () => {
      // Test with different threshold values
      const thresholds = [0.5, 0.7, 0.9];

      for (const threshold of thresholds) {
        // Mock the config
        const originalConfig = (orchestrator as any).effectiveConfig;
        (orchestrator as any).effectiveConfig = {
          ...originalConfig,
          daemon: {
            ...originalConfig.daemon,
            sessionRecovery: {
              ...originalConfig.daemon?.sessionRecovery,
              contextWindowThreshold: threshold,
            },
          },
        };

        // Create content that exceeds the threshold
        const contextWindow = 10000;
        const targetUtilization = threshold + 0.05; // 5% above threshold
        const targetTokens = targetUtilization * contextWindow;
        const chars = Math.floor(targetTokens * 4); // Approximate chars to tokens ratio

        const task = await orchestrator.createTask({
          description: `Threshold ${threshold} test`,
          conversation: [
            {
              type: 'user',
              content: [{ type: 'text', text: 'x'.repeat(chars) }],
            },
          ],
        });

        const status = await orchestrator.detectSessionLimit(task.id, contextWindow);

        expect(status.nearLimit).toBe(true);
        expect(status.utilization).toBeGreaterThanOrEqual(threshold);

        // Restore original config
        (orchestrator as any).effectiveConfig = originalConfig;
      }
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed messages gracefully', async () => {
      // Test with minimal message structure
      const task = await orchestrator.createTask({
        description: 'Malformed message test',
        conversation: [
          {
            type: 'user',
            content: [], // Empty content array
          },
          {
            type: 'assistant',
            content: [{ type: 'text', text: '' }], // Empty text
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThanOrEqual(0);
      expect(status.utilization).toBeGreaterThanOrEqual(0);
      expect(['continue', 'summarize', 'checkpoint', 'handoff']).toContain(status.recommendation);
    });

    it('should handle division by zero gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Zero division test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Test message' }],
          },
        ],
      });

      // Test with zero context window
      const status = await orchestrator.detectSessionLimit(task.id, 0);

      expect(status.utilization).toBe(Infinity);
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
      expect(status.message).toContain('critical');
    });

    it('should handle negative context window size', async () => {
      const task = await orchestrator.createTask({
        description: 'Negative context window test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Test message' }],
          },
        ],
      });

      // Test with negative context window
      const status = await orchestrator.detectSessionLimit(task.id, -1000);

      expect(status.utilization).toBeLessThan(0); // Negative utilization
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
    });

    it('should handle extremely large token counts', async () => {
      // Create a conversation that would theoretically exceed reasonable limits
      const hugeText = 'x'.repeat(10000000); // 10M characters
      const task = await orchestrator.createTask({
        description: 'Huge conversation test',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: hugeText }],
          },
        ],
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(1000000); // Should be over 1M tokens
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
    });
  });
});