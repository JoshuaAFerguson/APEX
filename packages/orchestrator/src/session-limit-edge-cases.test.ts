import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex, type AgentMessage } from '@apexcli/core';

describe('Session Limit Detection Edge Cases', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-session-limit-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'session-limit-test',
      language: 'typescript',
      framework: 'node',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.init();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('detectSessionLimit with various content types', () => {
    it('should handle messages with mixed content blocks', async () => {
      const mixedContent: AgentMessage[] = [
        {
          type: 'user',
          content: [
            { type: 'text', text: 'Please analyze this file' },
          ],
        },
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'I\'ll read the file for you.' },
            {
              type: 'tool_use',
              toolName: 'Read',
              toolInput: { file_path: '/path/to/large/file.ts' },
            },
          ],
        },
        {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: `// Large file content\n${'function test() { return true; }\n'.repeat(100)}`,
            },
          ],
        },
        {
          type: 'assistant',
          content: [
            { type: 'text', text: 'Based on the analysis, here are my findings...' },
            {
              type: 'tool_use',
              toolName: 'Write',
              toolInput: {
                file_path: '/path/to/output.md',
                content: '# Analysis Results\n\nThe code looks good.',
              },
            },
          ],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Mixed content test',
        conversation: mixedContent,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
      expect(['continue', 'summarize', 'checkpoint', 'handoff']).toContain(status.recommendation);
    });

    it('should handle tool results with deeply nested JSON structures', async () => {
      const complexToolResult = {
        analysis: {
          files: {
            'src/components/Button.tsx': {
              exports: ['Button', 'ButtonProps'],
              imports: ['React', 'styled'],
              functions: {
                Button: {
                  params: ['props'],
                  returnType: 'JSX.Element',
                  dependencies: ['styled.button'],
                },
              },
              tests: {
                coverage: 85.5,
                testFiles: ['Button.test.tsx'],
                scenarios: [
                  'renders correctly',
                  'handles click events',
                  'applies custom styles',
                ],
              },
            },
            'src/utils/helpers.ts': {
              exports: ['formatDate', 'validateEmail', 'debounce'],
              complexity: {
                formatDate: { cyclomatic: 3, cognitive: 2 },
                validateEmail: { cyclomatic: 5, cognitive: 4 },
                debounce: { cyclomatic: 7, cognitive: 6 },
              },
            },
          },
          metrics: {
            totalLines: 1247,
            totalFunctions: 23,
            testCoverage: 78.2,
            maintainabilityIndex: 85,
          },
          recommendations: [
            'Increase test coverage for validateEmail function',
            'Consider refactoring debounce function to reduce complexity',
            'Add JSDoc comments to exported functions',
          ],
        },
      };

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: complexToolResult,
            },
          ],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Complex JSON tool result test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
      expect(status.recommendation).toBeDefined();
    });

    it('should handle tool results with arrays of objects', async () => {
      const arrayToolResult = {
        testResults: Array.from({ length: 50 }, (_, i) => ({
          testId: `test_${i}`,
          name: `Test case ${i}`,
          status: i % 5 === 0 ? 'failed' : 'passed',
          duration: Math.random() * 1000,
          assertions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, j) => ({
            assertion: `Assertion ${j} for test ${i}`,
            passed: Math.random() > 0.1,
            message: Math.random() > 0.1 ? null : `Failed assertion ${j}`,
          })),
          metadata: {
            file: `test/unit/module${i % 5}.test.ts`,
            line: Math.floor(Math.random() * 100) + 1,
            tags: ['unit', Math.random() > 0.5 ? 'integration' : 'isolated'],
          },
        })),
        summary: {
          total: 50,
          passed: 43,
          failed: 7,
          skipped: 0,
          duration: 15432,
        },
      };

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: arrayToolResult,
            },
          ],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Array tool result test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(100); // Should be substantial
      expect(status.utilization).toBeGreaterThan(0);
    });

    it('should handle tool use with complex input parameters', async () => {
      const conversation: AgentMessage[] = [
        {
          type: 'assistant',
          content: [
            {
              type: 'tool_use',
              toolName: 'ConfigureBuildSystem',
              toolInput: {
                buildConfig: {
                  entry: './src/index.ts',
                  output: {
                    path: './dist',
                    filename: 'bundle.[contenthash].js',
                    chunkFilename: 'chunk.[contenthash].js',
                  },
                  optimization: {
                    minimize: true,
                    splitChunks: {
                      chunks: 'all',
                      cacheGroups: {
                        vendor: {
                          test: /[\\/]node_modules[\\/]/,
                          name: 'vendors',
                          chunks: 'all',
                        },
                        common: {
                          name: 'common',
                          minChunks: 2,
                          chunks: 'all',
                          enforce: true,
                        },
                      },
                    },
                  },
                  module: {
                    rules: [
                      {
                        test: /\.tsx?$/,
                        use: 'ts-loader',
                        exclude: /node_modules/,
                      },
                      {
                        test: /\.css$/,
                        use: ['style-loader', 'css-loader'],
                      },
                      {
                        test: /\.(png|svg|jpg|jpeg|gif)$/i,
                        type: 'asset/resource',
                      },
                    ],
                  },
                  plugins: [
                    { name: 'HtmlWebpackPlugin', options: { template: './src/index.html' } },
                    { name: 'CleanWebpackPlugin' },
                    { name: 'MiniCssExtractPlugin', options: { filename: 'styles.[contenthash].css' } },
                  ],
                  devServer: {
                    port: 3000,
                    hot: true,
                    historyApiFallback: true,
                  },
                },
              },
            },
          ],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Complex tool input test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
    });

    it('should handle conversation with binary-like content in tool results', async () => {
      const binaryContent = Array.from({ length: 1000 }, () =>
        Math.random().toString(36).substring(2, 15)
      ).join('');

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: {
                fileType: 'binary',
                base64Content: Buffer.from(binaryContent).toString('base64'),
                metadata: {
                  size: binaryContent.length,
                  encoding: 'base64',
                  checksum: 'sha256:abcd1234...',
                },
              },
            },
          ],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Binary content test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.utilization).toBeGreaterThan(0);
    });
  });

  describe('detectSessionLimit with extreme scenarios', () => {
    it('should handle conversation with extremely long single message', async () => {
      const extremelyLongText = 'A'.repeat(1000000); // 1M characters

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: extremelyLongText }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Extremely long message test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(200000); // Should be very large
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
    });

    it('should handle conversation with many small messages', async () => {
      const conversation: AgentMessage[] = Array.from({ length: 1000 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${i}: Hello world!` }],
      })) as AgentMessage[];

      const task = await orchestrator.createTask({
        description: 'Many small messages test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(1000);
      expect(status.utilization).toBeGreaterThan(0);
    });

    it('should handle conversation with alternating content types', async () => {
      const conversation: AgentMessage[] = [];

      for (let i = 0; i < 100; i++) {
        if (i % 4 === 0) {
          conversation.push({
            type: 'user',
            content: [{ type: 'text', text: `User message ${i}` }],
          });
        } else if (i % 4 === 1) {
          conversation.push({
            type: 'assistant',
            content: [
              { type: 'text', text: `Assistant response ${i}` },
              {
                type: 'tool_use',
                toolName: 'Read',
                toolInput: { file_path: `/path/file${i}.txt` },
              },
            ],
          });
        } else if (i % 4 === 2) {
          conversation.push({
            type: 'user',
            content: [
              {
                type: 'tool_result',
                toolResult: `File content for iteration ${i}`,
              },
            ],
          });
        } else {
          conversation.push({
            type: 'assistant',
            content: [{ type: 'text', text: `Analysis complete for step ${i}` }],
          });
        }
      }

      const task = await orchestrator.createTask({
        description: 'Alternating content types test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThan(100);
      expect(status.utilization).toBeGreaterThan(0);
    });

    it('should handle malformed or incomplete messages gracefully', async () => {
      // Create messages that might have missing or malformed content
      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [], // Empty content array
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: '' }], // Empty text
        },
        {
          type: 'user',
          content: [{ type: 'text', text: 'Valid message' }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Malformed messages test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id);

      expect(status.currentTokens).toBeGreaterThanOrEqual(0);
      expect(status.utilization).toBeGreaterThanOrEqual(0);
      expect(status.recommendation).toBeDefined();
    });
  });

  describe('detectSessionLimit with custom configurations', () => {
    it('should respect very low threshold configuration', async () => {
      // Mock the effective config to use a very low threshold
      const originalConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalConfig,
        daemon: {
          ...originalConfig.daemon,
          sessionRecovery: {
            ...originalConfig.daemon?.sessionRecovery,
            contextWindowThreshold: 0.1, // Very low threshold (10%)
          },
        },
      };

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'x'.repeat(8000) }], // ~2k tokens
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Very low threshold test',
        conversation,
      });

      // With a 20k context window, 2k tokens = 10%, should trigger checkpoint
      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('checkpoint');

      // Restore original config
      (orchestrator as any).effectiveConfig = originalConfig;
    });

    it('should respect very high threshold configuration', async () => {
      // Mock the effective config to use a very high threshold
      const originalConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalConfig,
        daemon: {
          ...originalConfig.daemon,
          sessionRecovery: {
            ...originalConfig.daemon?.sessionRecovery,
            contextWindowThreshold: 0.99, // Very high threshold (99%)
          },
        },
      };

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'x'.repeat(76000) }], // ~19k tokens
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Very high threshold test',
        conversation,
      });

      // With a 20k context window, 19k tokens = 95%, should not trigger with 99% threshold
      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.nearLimit).toBe(false);
      expect(status.recommendation).toBe('summarize');

      // Restore original config
      (orchestrator as any).effectiveConfig = originalConfig;
    });

    it('should handle undefined/null threshold configuration gracefully', async () => {
      const originalConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalConfig,
        daemon: {
          ...originalConfig.daemon,
          sessionRecovery: undefined,
        },
      };

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'x'.repeat(64000) }], // ~16k tokens
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Undefined threshold test',
        conversation,
      });

      // Should use default threshold (0.8)
      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.utilization).toBe(0.8); // 16k/20k
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('checkpoint');

      // Restore original config
      (orchestrator as any).effectiveConfig = originalConfig;
    });
  });

  describe('detectSessionLimit performance with large data', () => {
    it('should handle token estimation efficiently for large conversations', async () => {
      // Create a very large conversation
      const largeConversation: AgentMessage[] = [];

      for (let i = 0; i < 500; i++) {
        largeConversation.push({
          type: 'user',
          content: [{ type: 'text', text: `User message ${i}: ${'x'.repeat(1000)}` }],
        });
        largeConversation.push({
          type: 'assistant',
          content: [
            { type: 'text', text: `Assistant response ${i}: ${'y'.repeat(800)}` },
            {
              type: 'tool_use',
              toolName: 'Read',
              toolInput: {
                file_path: `/path/to/file${i}.ts`,
                options: { encoding: 'utf8', maxSize: 1000000 },
              },
            },
          ],
        });
        largeConversation.push({
          type: 'user',
          content: [
            {
              type: 'tool_result',
              toolResult: `File content ${i}: ${'z'.repeat(1200)}`,
            },
          ],
        });
      }

      const task = await orchestrator.createTask({
        description: 'Performance test with large conversation',
        conversation: largeConversation,
      });

      // Measure performance
      const startTime = Date.now();
      const status = await orchestrator.detectSessionLimit(task.id);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      expect(status.currentTokens).toBeGreaterThan(100000);
      expect(status.utilization).toBeGreaterThan(0);
      expect(status.recommendation).toBe('handoff');
    });

    it('should handle repeated calls efficiently (caching behavior)', async () => {
      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'x'.repeat(10000) }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Repeated calls test',
        conversation,
      });

      // First call
      const start1 = Date.now();
      const status1 = await orchestrator.detectSessionLimit(task.id);
      const end1 = Date.now();

      // Second call (might benefit from any internal caching)
      const start2 = Date.now();
      const status2 = await orchestrator.detectSessionLimit(task.id);
      const end2 = Date.now();

      // Results should be identical
      expect(status1).toEqual(status2);

      // Both calls should be reasonably fast
      expect(end1 - start1).toBeLessThan(1000);
      expect(end2 - start2).toBeLessThan(1000);
    });
  });

  describe('detectSessionLimit boundary conditions', () => {
    it('should handle exact 60% utilization boundary', async () => {
      // Create content that will be exactly 60% of context window
      const targetTokens = 12000; // 60% of 20k
      const text = 'x'.repeat(targetTokens * 4); // Approximate chars to tokens

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text }],
        },
      ];

      const task = await orchestrator.createTask({
        description: '60% boundary test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      // Should be right at the boundary between continue and summarize
      expect(status.utilization).toBeGreaterThan(0.58);
      expect(status.utilization).toBeLessThan(0.62);
      expect(status.recommendation).toBe('summarize');
    });

    it('should handle exact threshold boundary', async () => {
      // Mock config for exact 70% threshold
      const originalConfig = (orchestrator as any).effectiveConfig;
      (orchestrator as any).effectiveConfig = {
        ...originalConfig,
        daemon: {
          ...originalConfig.daemon,
          sessionRecovery: {
            ...originalConfig.daemon?.sessionRecovery,
            contextWindowThreshold: 0.7,
          },
        },
      };

      // Create content exactly at threshold
      const targetTokens = 14000; // 70% of 20k
      const text = 'x'.repeat(targetTokens * 4);

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Threshold boundary test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('checkpoint');

      // Restore original config
      (orchestrator as any).effectiveConfig = originalConfig;
    });

    it('should handle exact 95% utilization boundary', async () => {
      // Create content exactly at 95% to test checkpoint vs handoff boundary
      const targetTokens = 19000; // 95% of 20k
      const text = 'x'.repeat(targetTokens * 4);

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text }],
        },
      ];

      const task = await orchestrator.createTask({
        description: '95% boundary test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id, 20000);

      expect(status.utilization).toBeGreaterThan(0.93);
      expect(status.nearLimit).toBe(true);
      expect(status.recommendation).toBe('handoff');
    });

    it('should handle floating point precision issues', async () => {
      // Use a context window size that might cause floating point precision issues
      const contextWindow = 33333; // Odd number that might cause precision issues
      const targetTokens = Math.floor(contextWindow * 0.8); // Should be exactly at threshold

      const text = 'x'.repeat(targetTokens * 4);

      const conversation: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text }],
        },
      ];

      const task = await orchestrator.createTask({
        description: 'Floating point precision test',
        conversation,
      });

      const status = await orchestrator.detectSessionLimit(task.id, contextWindow);

      expect(status.utilization).toBeGreaterThan(0.75);
      expect(status.utilization).toBeLessThan(0.85);
      expect(['summarize', 'checkpoint']).toContain(status.recommendation);
    });
  });
});