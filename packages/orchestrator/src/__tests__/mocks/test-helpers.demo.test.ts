/**
 * Demonstration of simplified test utilities usage
 *
 * Shows how the enhanced test helpers make it easy to write
 * comprehensive tests for Claude Agent SDK integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHelper,
  TestPatterns,
  setupTestEnvironment
} from './test-helpers';
import { query } from '@anthropic-ai/claude-agent-sdk';

describe('Test Helpers Demo - Simplified Testing', () => {
  describe('Quick Setup Examples', () => {
    it('should make file system testing trivial', async () => {
      // One-line setup for complete test environment
      const { helper, mockSDK } = setupTestEnvironment();

      // One-line setup for all file system tools
      helper.setupFileSystemTools();

      // One method to setup a realistic workflow
      helper.setupToolWorkflow([
        {
          thinking: 'I need to check what files exist',
          toolName: 'Glob',
          input: { pattern: '*.ts' }
        },
        {
          thinking: 'Let me read the main file',
          toolName: 'Read',
          input: { file_path: 'app.ts' }
        },
        {
          thinking: 'Now I\'ll update it',
          toolName: 'Write',
          input: { file_path: 'app.ts', content: 'updated content' }
        }
      ]);

      // Execute
      const agent = helper.getAgent();
      const result = query(agent, 'Update the app file');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      // One method to verify everything worked
      helper.assertToolsExecuted([
        { toolName: 'Glob', expectedCalls: 1, shouldSucceed: true },
        { toolName: 'Read', expectedCalls: 1, shouldSucceed: true },
        { toolName: 'Write', expectedCalls: 1, shouldSucceed: true }
      ]);

      // One method to verify call order
      helper.assertCallSequence(['Glob', 'Read', 'Write']);

      expect(helper.getExecutionSummary().totalToolCalls).toBe(3);
    });

    it('should make error testing simple', async () => {
      const helper = createTestHelper();

      // One line to setup error scenario
      helper.setupErrorScenario(new Error('Network timeout'), 2);

      const agent = helper.getAgent();

      // First two calls succeed
      for (let i = 0; i < 2; i++) {
        const result = query(agent, `Call ${i + 1}`);
        const responses = [];
        for await (const response of result) {
          responses.push(response);
        }
        expect(responses[0].message.content[0].text).toBe(`Success ${i + 1}`);
      }

      // Third call fails
      await expect(async () => {
        const result = query(agent, 'Call 3');
        for await (const response of result) {
          // Should throw
        }
      }).rejects.toThrow('Network timeout');
    });

    it('should make streaming testing effortless', async () => {
      const helper = createTestHelper();

      // One method to setup realistic streaming
      helper.setupStreamingWorkflow([
        { type: 'thinking', content: 'Processing...', delay: 100 },
        { type: 'text', content: 'Step 1 complete', delay: 200 },
        { type: 'thinking', content: 'Continuing...', delay: 150 },
        { type: 'text', content: 'All done!', delay: 100 }
      ]);

      const startTime = Date.now();
      const agent = helper.getAgent();
      const result = query(agent, 'Process the request');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      // Automatically verify timing and content
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(500);
      expect(responses.length).toBeGreaterThan(3);

      // Verify content types are present
      const hasThinking = responses.some(r =>
        r.message?.content.some(c => c.type === 'thinking')
      );
      expect(hasThinking).toBe(true);
    });
  });

  describe('Pre-built Test Patterns', () => {
    let helper: ReturnType<typeof createTestHelper>;

    beforeEach(() => {
      helper = createTestHelper();
    });

    it('should use file operations pattern', async () => {
      // Apply complete pattern in one line
      TestPatterns.fileOperations.setup(helper.getSDK());

      const agent = helper.getAgent();
      const result = query(agent, 'Process files');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      // Pattern automatically includes thinking, tool use, and success message
      const content = responses[0].message.content;
      expect(content.some(c => c.type === 'thinking')).toBe(true);
      expect(content.some(c => c.type === 'tool_use' && c.name === 'Read')).toBe(true);
      expect(content.some(c => c.type === 'tool_use' && c.name === 'Write')).toBe(true);
      expect(content.some(c => c.type === 'text')).toBe(true);
    });

    it('should use error recovery pattern', async () => {
      TestPatterns.errorRecovery.setup(helper.getSDK());

      const agent = helper.getAgent();

      // First call fails
      await expect(async () => {
        const result = query(agent, 'First attempt');
        for await (const response of result) {
          // Will throw
        }
      }).rejects.toThrow('Initial failure');

      // Second call succeeds
      const result = query(agent, 'Recovery attempt');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses[0].message.content[0].text).toBe('Recovered successfully');
    });

    it('should use streaming progress pattern', async () => {
      TestPatterns.streamingProgress.setup(helper.getSDK());

      const startTime = Date.now();
      const agent = helper.getAgent();
      const result = query(agent, 'Show progress');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      // Pattern includes realistic timing and progress messages
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(550);

      const progressTexts = responses
        .flatMap(r => r.message?.content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text);

      expect(progressTexts).toContain('Progress: 25%');
      expect(progressTexts).toContain('Progress: 100% - Complete!');
    });
  });

  describe('Advanced Scenarios Made Simple', () => {
    it('should test multi-tool workflows with one assertion', async () => {
      const helper = createTestHelper();

      helper.setupFileSystemTools();

      // Setup complex workflow
      helper.setupToolWorkflow([
        { toolName: 'Glob', input: { pattern: '**/*.ts' } },
        { toolName: 'Read', input: { file_path: 'src/main.ts' } },
        { toolName: 'Grep', input: { pattern: 'export', path: 'src/main.ts' } },
        { toolName: 'Write', input: { file_path: 'src/main.ts', content: 'new content' } }
      ]);

      const agent = helper.getAgent();
      const result = query(agent, 'Refactor the main file');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      // One assertion to verify the entire workflow
      helper.assertToolsExecuted([
        { toolName: 'Glob', expectedCalls: 1, shouldSucceed: true },
        { toolName: 'Read', expectedCalls: 1, shouldSucceed: true },
        { toolName: 'Grep', expectedCalls: 1, shouldSucceed: true },
        { toolName: 'Write', expectedCalls: 1, shouldSucceed: true }
      ]);

      // Verify exact sequence
      helper.assertCallSequence(['Glob', 'Read', 'Grep', 'Write']);

      // Get comprehensive summary
      const summary = helper.getExecutionSummary();
      expect(summary.totalToolCalls).toBe(4);
      expect(summary.errors).toBe(0);
      expect(Object.keys(summary.toolUsage)).toEqual(['Glob', 'Read', 'Grep', 'Write']);
    });
  });
});

describe('Real-world Testing Scenarios', () => {
  it('should simulate code refactoring workflow', async () => {
    const { helper } = setupTestEnvironment();

    // Setup development environment
    helper.setupFileSystemTools();
    helper.setupReadTool([
      { path: 'src/components/Button.tsx', content: 'export const Button = () => <button>Click</button>;' },
      { path: 'src/components/Card.tsx', content: 'export const Card = () => <div>Card</div>;' }
    ]);

    // Realistic refactoring workflow
    helper.setupToolWorkflow([
      {
        thinking: 'I need to find all React components first',
        toolName: 'Glob',
        input: { pattern: 'src/components/*.tsx' }
      },
      {
        thinking: 'Let me examine the Button component',
        toolName: 'Read',
        input: { file_path: 'src/components/Button.tsx' }
      },
      {
        thinking: 'I\'ll refactor it to use TypeScript interfaces',
        toolName: 'Write',
        input: {
          file_path: 'src/components/Button.tsx',
          content: 'interface ButtonProps { onClick: () => void; } export const Button = ({ onClick }: ButtonProps) => <button onClick={onClick}>Click</button>;'
        }
      },
      {
        thinking: 'Now let me update the Card component too',
        toolName: 'Read',
        input: { file_path: 'src/components/Card.tsx' }
      },
      {
        thinking: 'Adding proper TypeScript interfaces',
        toolName: 'Write',
        input: {
          file_path: 'src/components/Card.tsx',
          content: 'interface CardProps { title: string; } export const Card = ({ title }: CardProps) => <div>{title}</div>;'
        }
      }
    ]);

    const agent = helper.getAgent();
    const result = query(agent, 'Refactor React components to use TypeScript interfaces');
    const responses = [];
    for await (const response of result) {
      responses.push(response);
    }

    // Comprehensive verification in a few lines
    helper.assertToolsExecuted([
      {
        toolName: 'Glob',
        expectedCalls: 1,
        expectedInputs: [{ pattern: 'src/components/*.tsx' }],
        shouldSucceed: true
      },
      {
        toolName: 'Read',
        expectedCalls: 2,
        shouldSucceed: true
      },
      {
        toolName: 'Write',
        expectedCalls: 2,
        shouldSucceed: true,
        expectedOutputPattern: /Successfully wrote/
      }
    ]);

    helper.assertCallSequence(['Glob', 'Read', 'Write', 'Read', 'Write']);

    const summary = helper.getExecutionSummary();
    expect(summary.totalToolCalls).toBe(5);
    expect(summary.toolUsage.Read).toBe(2);
    expect(summary.toolUsage.Write).toBe(2);
  });
});