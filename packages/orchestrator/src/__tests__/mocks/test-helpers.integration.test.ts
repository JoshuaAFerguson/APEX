/**
 * Integration tests for enhanced test helpers
 *
 * Demonstrates comprehensive usage patterns for the Claude Agent SDK
 * tool mocking utilities with practical testing scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestHelper,
  TestPatterns,
  createTestHelper,
  setupTestEnvironment,
  verifyToolInteractionPattern,
  type ToolExecutionExpectation
} from './test-helpers';
import { query } from '@anthropic-ai/claude-agent-sdk';

describe('Enhanced Test Helpers Integration', () => {
  let helper: TestHelper;
  let mockSDK: ReturnType<typeof setupTestEnvironment>['mockSDK'];
  let toolRegistry: ReturnType<typeof setupTestEnvironment>['toolRegistry'];

  beforeEach(() => {
    const testEnv = setupTestEnvironment();
    helper = testEnv.helper;
    mockSDK = testEnv.mockSDK;
    toolRegistry = testEnv.toolRegistry;
  });

  describe('File System Operations Testing', () => {
    it('should test complete file operation workflow', async () => {
      // Setup file system tools with mock file data
      helper.setupReadTool([
        { path: '/src/app.ts', content: 'export const app = "hello";' },
        { path: '/src/config.ts', content: 'export const config = { debug: false };' }
      ]);

      helper.setupWriteTool();
      helper.setupGlobTool(['/src/app.ts', '/src/config.ts', '/src/utils.ts']);

      // Setup workflow that uses multiple file operations
      helper.setupToolWorkflow([
        {
          thinking: 'I need to examine the existing files first',
          toolName: 'Glob',
          input: { pattern: '/src/*.ts' },
          result: 'Found 3 TypeScript files'
        },
        {
          thinking: 'Let me read the main app file',
          toolName: 'Read',
          input: { file_path: '/src/app.ts' },
          result: 'File content loaded successfully'
        },
        {
          thinking: 'Now I\'ll update the configuration',
          toolName: 'Write',
          input: { file_path: '/src/config.ts', content: 'export const config = { debug: true };' },
          result: 'Configuration updated'
        }
      ]);

      // Execute the workflow
      const agent = helper.getAgent();
      const result = query(agent, 'Update the debug configuration');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      // Verify the workflow executed correctly
      const expectations: ToolExecutionExpectation[] = [
        {
          toolName: 'Glob',
          expectedCalls: 1,
          expectedInputs: [{ pattern: '/src/*.ts' }],
          shouldSucceed: true,
          expectedOutputPattern: /app\.ts.*config\.ts.*utils\.ts/
        },
        {
          toolName: 'Read',
          expectedCalls: 1,
          expectedInputs: [{ file_path: '/src/app.ts' }],
          shouldSucceed: true,
          expectedOutputPattern: 'export const app = "hello";'
        },
        {
          toolName: 'Write',
          expectedCalls: 1,
          expectedInputs: [{ file_path: '/src/config.ts', content: 'export const config = { debug: true };' }],
          shouldSucceed: true
        }
      ];

      helper.assertToolsExecuted(expectations);
      helper.assertCallSequence(['Glob', 'Read', 'Write']);

      // Verify SDK interaction
      helper.assertSDKCallHistory({
        totalCalls: 1,
        messages: ['Update the debug configuration']
      });
    });

    it('should handle file system errors gracefully', async () => {
      // Setup tools with error conditions
      helper.setupReadTool([]); // No files available
      helper.setupErrorScenario(new Error('File system unavailable'), 1);

      const agent = helper.getAgent();

      // First call should succeed
      let result = query(agent, 'Initial setup');
      let responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses[0].message.content[0].text).toBe('Success 1');

      // Second call should fail
      await expect(async () => {
        result = query(agent, 'Read nonexistent file');
        for await (const response of result) {
          // Should throw during iteration
        }
      }).rejects.toThrow('File system unavailable');

      // Verify error was tracked
      const summary = helper.getExecutionSummary();
      expect(summary.errors).toBeGreaterThan(0);
    });
  });

  describe('Streaming Workflow Testing', () => {
    it('should test progressive streaming responses', async () => {
      helper.setupStreamingWorkflow([
        { type: 'thinking', content: 'Analyzing the codebase structure...', delay: 100 },
        { type: 'text', content: 'Found 15 TypeScript files', delay: 200 },
        { type: 'thinking', content: 'Examining dependencies...', delay: 150 },
        { type: 'text', content: 'Identified 3 key architectural patterns', delay: 200 },
        { type: 'tool', content: 'generate_report', delay: 100 },
        { type: 'text', content: 'Analysis complete!', delay: 50 }
      ]);

      const startTime = Date.now();
      const agent = helper.getAgent();
      const result = query(agent, 'Analyze the project architecture');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      const duration = Date.now() - startTime;

      // Verify streaming timing (total delays: 800ms)
      expect(duration).toBeGreaterThanOrEqual(750);

      // Verify response structure
      expect(responses.length).toBeGreaterThan(5);

      // Check for specific content types in streaming
      const hasThinking = responses.some(r =>
        r.message?.content.some(c => c.type === 'thinking')
      );
      const hasToolUse = responses.some(r =>
        r.message?.content.some(c => c.type === 'tool_use')
      );
      const hasUsage = responses.some(r => r.type === 'usage');

      expect(hasThinking).toBe(true);
      expect(hasToolUse).toBe(true);
      expect(hasUsage).toBe(true);
    });
  });

  describe('Common Test Patterns', () => {
    it('should apply file operations pattern', async () => {
      TestPatterns.fileOperations.setup(mockSDK);

      const agent = helper.getAgent();
      const result = query(agent, 'Process the test file');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      // Verify pattern was applied correctly
      const content = responses[0].message.content;

      const thinkingBlocks = content.filter(block => block.type === 'thinking');
      expect(thinkingBlocks.length).toBeGreaterThanOrEqual(2);

      const toolUseBlocks = content.filter(block => block.type === 'tool_use');
      expect(toolUseBlocks.length).toBe(2);
      expect(toolUseBlocks[0].name).toBe('Read');
      expect(toolUseBlocks[1].name).toBe('Write');
    });

    it('should apply error recovery pattern', async () => {
      TestPatterns.errorRecovery.setup(mockSDK);

      const agent = helper.getAgent();

      // First call should fail
      await expect(async () => {
        const result = query(agent, 'This will fail');
        for await (const response of result) {
          // Should not reach here
        }
      }).rejects.toThrow('Initial failure');

      // Second call should succeed
      const result = query(agent, 'This will recover');
      const responses = [];
      for await (const response of result) {
        responses.push(response);
      }

      expect(responses[0].message.content[0].text).toBe('Recovered successfully');
    });

    it('should apply streaming progress pattern', async () => {
      TestPatterns.streamingProgress.setup(mockSDK);

      const startTime = Date.now();
      const agent = helper.getAgent();
      const result = query(agent, 'Show progress');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      const duration = Date.now() - startTime;

      // Verify timing (600ms total delay)
      expect(duration).toBeGreaterThanOrEqual(550);

      // Verify progress messages
      const textBlocks = responses
        .flatMap(r => r.message?.content || [])
        .filter(c => c.type === 'text');

      const progressMessages = textBlocks.map(c => c.text);
      expect(progressMessages).toContain('Progress: 25%');
      expect(progressMessages).toContain('Progress: 50%');
      expect(progressMessages).toContain('Progress: 75%');
      expect(progressMessages).toContain('Progress: 100% - Complete!');
    });
  });

  describe('Advanced Tool Interaction Patterns', () => {
    it('should verify complex multi-tool workflows', async () => {
      // Setup a sophisticated development workflow
      helper.setupFileSystemTools();

      // Register additional tools for the workflow
      const { z } = await import('zod');

      toolRegistry.registerTool('Bash', 'Execute shell commands',
        z.object({ command: z.string() }),
        {
          response: {
            content: [{ type: 'text', text: 'Command executed successfully' }],
            isError: false
          }
        }
      );

      toolRegistry.registerTool('GitCommit', 'Commit changes to git',
        z.object({ message: z.string() }),
        {
          response: {
            content: [{ type: 'text', text: 'Changes committed successfully' }],
            isError: false
          }
        }
      );

      // Setup complex workflow
      const complexWorkflow = require('./index').MockResponseBuilder.create()
        .withThinking('I need to implement the new feature')
        .withToolUse('glob_1', 'Glob', { pattern: '**/*.ts' })
        .withThinking('Found the files, now reading the main component')
        .withToolUse('read_1', 'Read', { file_path: '/src/components/App.tsx' })
        .withThinking('Implementing the new functionality')
        .withToolUse('write_1', 'Write', {
          file_path: '/src/components/App.tsx',
          content: 'export const App = () => <div>Enhanced App</div>;'
        })
        .withThinking('Running tests to verify the changes')
        .withToolUse('test_1', 'Bash', { command: 'npm test' })
        .withThinking('Tests passed, committing the changes')
        .withToolUse('commit_1', 'GitCommit', { message: 'feat: enhance App component' })
        .withText('Feature implementation completed successfully')
        .withUsage(500, 300)
        .build();

      mockSDK.addResponse(complexWorkflow);

      // Execute workflow
      const agent = helper.getAgent();
      const result = query(agent, 'Implement the new feature with proper testing and commit');
      const responses = [];

      for await (const response of result) {
        responses.push(response);
      }

      // Use advanced pattern verification
      verifyToolInteractionPattern(toolRegistry, {
        description: 'Development workflow with testing and commit',
        sequence: ['Glob', 'Read', 'Write', 'Bash', 'GitCommit'],
        expectations: [
          {
            tool: 'Glob',
            input: { pattern: '**/*.ts' },
            shouldSucceed: true
          },
          {
            tool: 'Read',
            input: { file_path: '/src/components/App.tsx' },
            shouldSucceed: true
          },
          {
            tool: 'Write',
            input: (input) => {
              return input.file_path === '/src/components/App.tsx' &&
                     typeof input.content === 'string' &&
                     input.content.includes('Enhanced App');
            },
            shouldSucceed: true
          },
          {
            tool: 'Bash',
            input: { command: 'npm test' },
            output: 'Command executed successfully',
            shouldSucceed: true
          },
          {
            tool: 'GitCommit',
            input: { message: 'feat: enhance App component' },
            output: 'Changes committed successfully',
            shouldSucceed: true
          }
        ]
      });

      // Verify execution summary
      const summary = helper.getExecutionSummary();
      expect(summary.totalToolCalls).toBe(5);
      expect(summary.errors).toBe(0);
      expect(summary.toolUsage['Glob']).toBe(1);
      expect(summary.toolUsage['Read']).toBe(1);
      expect(summary.toolUsage['Write']).toBe(1);
      expect(summary.toolUsage['Bash']).toBe(1);
      expect(summary.toolUsage['GitCommit']).toBe(1);
    });
  });

  describe('Multi-Agent Workflow Testing', () => {
    it('should test multi-agent collaboration', async () => {
      // Create different agents for different roles
      const planner = helper.createTestAgent('planner', ['Glob', 'Read']);
      const developer = helper.createTestAgent('developer', ['Write', 'Bash']);
      const tester = helper.createTestAgent('tester', ['Bash']);

      // Setup responses for each agent
      mockSDK
        .addResponse({ content: 'Planning phase completed', usage: { inputTokens: 100, outputTokens: 50 } })
        .addResponse({ content: 'Development phase completed', usage: { inputTokens: 200, outputTokens: 150 } })
        .addResponse({ content: 'Testing phase completed', usage: { inputTokens: 150, outputTokens: 100 } });

      // Simulate multi-agent workflow
      await helper.simulateWorkflow([
        {
          agent: planner,
          message: 'Analyze the project structure',
          expectedResponse: (responses) => {
            expect(responses[0].message.content[0].text).toBe('Planning phase completed');
          }
        },
        {
          agent: developer,
          message: 'Implement the planned features',
          expectedResponse: (responses) => {
            expect(responses[0].message.content[0].text).toBe('Development phase completed');
          }
        },
        {
          agent: tester,
          message: 'Run comprehensive tests',
          expectedResponse: (responses) => {
            expect(responses[0].message.content[0].text).toBe('Testing phase completed');
          }
        }
      ]);

      // Verify multi-agent interaction
      helper.assertSDKCallHistory({
        totalCalls: 3,
        agents: ['planner', 'developer', 'tester'],
        messages: [
          'Analyze the project structure',
          'Implement the planned features',
          'Run comprehensive tests'
        ]
      });
    });
  });

  describe('Edge Case Testing', () => {
    it('should handle tool execution limits and timeouts', async () => {
      // Setup tool with execution limits
      const limitedTool = require('./index').createMockTool('LimitedTool')
        .withTextResponse('Success')
        .withMaxInvocations(2)
        .build();

      toolRegistry.registerTool(
        limitedTool.name,
        limitedTool.description,
        limitedTool.schema,
        limitedTool.config
      );

      // First two executions should succeed
      await toolRegistry.simulateExecution('LimitedTool', {});
      await toolRegistry.simulateExecution('LimitedTool', {});

      // Third execution should fail
      await expect(
        toolRegistry.simulateExecution('LimitedTool', {})
      ).rejects.toThrow('exceeded max invocations');

      expect(toolRegistry.getInvocationCount('LimitedTool')).toBe(3);
    });

    it('should handle permission checks', async () => {
      // Setup permission checker
      toolRegistry.setPermissionChecker(async (toolName, input) => {
        return toolName === 'Write' ? 'deny' : 'allow';
      });

      helper.setupFileSystemTools();

      // Read should succeed
      await expect(
        toolRegistry.simulateExecution('Read', { file_path: '/test.txt' }, { checkPermissions: true })
      ).resolves.not.toThrow();

      // Write should fail due to permissions
      await expect(
        toolRegistry.simulateExecution('Write', { file_path: '/test.txt', content: 'test' }, { checkPermissions: true })
      ).rejects.toThrow('Permission denied');
    });
  });
});

describe('Test Utilities Factory Functions', () => {
  it('should create test helper with configuration', () => {
    const customAgent = {
      name: 'custom-agent',
      models: ['claude-3-sonnet-20240229'],
      systemPrompt: 'Custom agent for testing',
      tools: ['Read', 'Write']
    };

    const helper = createTestHelper({
      agent: customAgent,
      autoReset: true
    });

    expect(helper.getAgent().name).toBe('custom-agent');
    expect(helper.getAgent().tools).toEqual(['Read', 'Write']);
  });

  it('should setup complete test environment', () => {
    const { helper, mockSDK, toolRegistry } = setupTestEnvironment();

    expect(helper).toBeInstanceOf(TestHelper);
    expect(mockSDK).toBeDefined();
    expect(toolRegistry).toBeDefined();

    // Verify integration
    expect(helper.getSDK()).toBe(mockSDK);
    expect(helper.getToolRegistry()).toBe(toolRegistry);
  });
});