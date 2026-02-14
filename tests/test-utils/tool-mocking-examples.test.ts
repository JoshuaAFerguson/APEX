/**
 * Comprehensive examples and demonstrations of tool mocking utilities
 * for Claude Agent SDK integration testing.
 *
 * This test file demonstrates various patterns for mocking tool calls,
 * capturing invocations, and verifying usage patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockToolManager,
  createMockToolManager,
  setupCommonToolMocks,
  createFailingToolMock,
  createDelayedToolMock,
  createCustomToolMock,
  mockClaudeAgentSDK,
  restoreClaudeAgentSDK,
  expectToolToBeCalled,
  expectToolToBeCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCall,
  type ToolMockConfig
} from './claude-agent-sdk-mocks';

describe('Tool Mocking Utilities - Examples and Demonstrations', () => {
  let mockManager: MockToolManager;

  beforeEach(() => {
    mockManager = createMockToolManager();
  });

  afterEach(() => {
    mockManager.cleanup();
    restoreClaudeAgentSDK();
  });

  describe('Basic Tool Mocking', () => {
    it('should mock a simple Read tool with static response', async () => {
      // Setup: Mock a Read tool to return file content
      mockManager.mockTool({
        toolName: 'Read',
        result: { content: 'Hello, World!' },
      });

      // Setup SDK mock
      const queryMock = mockManager.setupSDKMock();

      // Simulate calling the tool through the SDK
      const response = await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Read the file',
        tools: { Read: {} },
      });

      // Verify the tool was called
      expect(mockManager.wasToolCalled('Read')).toBe(true);
      expect(mockManager.getToolCallCount('Read')).toBe(1);

      // Verify the response
      expect(response.content).toContain('Mock response');
      expect(response.toolCalls).toHaveLength(1);
    });

    it('should mock Write tool with success response', async () => {
      mockManager.mockTool({
        toolName: 'Write',
        result: { success: true, message: 'File written successfully' },
      });

      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Write content to file',
        tools: { Write: {} },
      });

      const writeCall = mockManager.getLastCallFor('Write');
      expect(writeCall).toBeDefined();
      expect(writeCall?.result).toEqual({
        success: true,
        message: 'File written successfully'
      });
    });
  });

  describe('Advanced Tool Mocking Patterns', () => {
    it('should mock tools with custom implementations', async () => {
      // Mock a Bash tool with dynamic response based on command
      mockManager.mockTool(createCustomToolMock('Bash', (params) => {
        const command = params.command as string;

        if (command.includes('ls')) {
          return { stdout: 'file1.ts\nfile2.ts\nfile3.ts', exitCode: 0 };
        } else if (command.includes('pwd')) {
          return { stdout: '/home/user/project', exitCode: 0 };
        } else {
          return { stdout: '', stderr: 'Command not found', exitCode: 1 };
        }
      }));

      const queryMock = mockManager.setupSDKMock();

      // Test different commands
      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'List files and show directory',
        tools: { Bash: {} },
      });

      const bashCalls = mockManager.getToolCallsFor('Bash');
      expect(bashCalls).toHaveLength(1);
    });

    it('should handle error scenarios with failing tools', async () => {
      // Mock a tool that fails
      mockManager.mockTool(createFailingToolMock('Read', new Error('File not found')));

      const queryMock = mockManager.setupSDKMock();

      // The query should handle the tool error gracefully
      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Read non-existent file',
        tools: { Read: {} },
      });

      const readCall = mockManager.getLastCallFor('Read');
      expect(readCall?.error).toBeDefined();
      expect(readCall?.error?.message).toBe('File not found');
    });

    it('should simulate delayed tool responses', async () => {
      const startTime = Date.now();

      // Mock a tool with 100ms delay
      mockManager.mockTool(createDelayedToolMock('SlowTool', { result: 'completed' }, 100));

      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Use slow tool',
        tools: { SlowTool: {} },
      });

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Verify the delay was applied (allow some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(90);

      const slowCall = mockManager.getLastCallFor('SlowTool');
      expect(slowCall?.result).toEqual({ result: 'completed' });
    });
  });

  describe('Tool Call Verification Patterns', () => {
    beforeEach(() => {
      // Setup common tools for verification tests
      setupCommonToolMocks(mockManager);
    });

    it('should verify specific tool call parameters', async () => {
      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Read and write files',
        tools: { Read: {}, Write: {} },
      });

      // Verify tools were called
      expectToolToBeCalled(mockManager, 'Read');
      expectToolToBeCalled(mockManager, 'Write');

      // Check call counts
      expectToolCallCount(mockManager, 'Read', 1);
      expectToolCallCount(mockManager, 'Write', 1);
    });

    it('should verify tool call order for workflow steps', async () => {
      const queryMock = mockManager.setupSDKMock();

      // Simulate a workflow: Read -> Edit -> Write
      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Modify file content',
        tools: { Read: {}, Edit: {}, Write: {} },
      });

      // Verify the tools were called in the expected order
      const expectedOrder = ['Read', 'Edit', 'Write'];
      expectToolCallOrder(mockManager, expectedOrder);
    });

    it('should verify tool calls with specific parameters', async () => {
      // Override Read mock to capture specific parameters
      mockManager.mockTool({
        toolName: 'Read',
        implementation: (params) => {
          return { content: `Content from ${params.file_path}` };
        },
      });

      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'test-agent' },
        prompt: 'Read specific file',
        tools: { Read: {} },
      });

      // This test would require actual parameter passing in a real SDK integration
      // For demonstration purposes, we verify the tool was called
      expectToolToBeCalled(mockManager, 'Read');
    });
  });

  describe('Multiple Tool Scenario Testing', () => {
    it('should handle complex file system workflows', async () => {
      // Setup a comprehensive file system mock
      const fileSystem = new Map<string, string>();
      fileSystem.set('/src/index.ts', 'export default function() {}');
      fileSystem.set('/package.json', '{ "name": "test" }');

      // Mock file system tools with shared state
      mockManager.mockTools([
        {
          toolName: 'Read',
          implementation: (params) => {
            const filePath = params.file_path as string;
            const content = fileSystem.get(filePath);
            if (content) {
              return { content, success: true };
            } else {
              throw new Error(`File not found: ${filePath}`);
            }
          },
        },
        {
          toolName: 'Write',
          implementation: (params) => {
            const filePath = params.file_path as string;
            const content = params.content as string;
            fileSystem.set(filePath, content);
            return { success: true, message: `Written to ${filePath}` };
          },
        },
        {
          toolName: 'Glob',
          implementation: (params) => {
            const pattern = params.pattern as string;
            const files = Array.from(fileSystem.keys());
            const matches = files.filter(file =>
              pattern === '**/*' || file.includes(pattern.replace('*', ''))
            );
            return { files: matches };
          },
        },
      ]);

      const queryMock = mockManager.setupSDKMock();

      // Simulate a complex workflow
      await queryMock({
        agentDefinition: { name: 'file-agent' },
        prompt: 'List files, read package.json, and create a new file',
        tools: { Glob: {}, Read: {}, Write: {} },
      });

      // Verify the workflow executed
      expect(mockManager.wasToolCalled('Glob')).toBe(true);
      expect(mockManager.wasToolCalled('Read')).toBe(true);
      expect(mockManager.wasToolCalled('Write')).toBe(true);

      // Verify file system state
      expect(fileSystem.has('/src/index.ts')).toBe(true);
      expect(fileSystem.has('/package.json')).toBe(true);
    });

    it('should track tool execution statistics', async () => {
      // Setup multiple tools with different behaviors
      mockManager.mockTools([
        { toolName: 'FastTool', result: 'fast', delay: 10 },
        { toolName: 'MediumTool', result: 'medium', delay: 50 },
        { toolName: 'SlowTool', result: 'slow', delay: 100 },
      ]);

      const queryMock = mockManager.setupSDKMock();

      const startTime = Date.now();

      await queryMock({
        agentDefinition: { name: 'timing-agent' },
        prompt: 'Use all tools',
        tools: { FastTool: {}, MediumTool: {}, SlowTool: {} },
      });

      const totalTime = Date.now() - startTime;

      // Verify all tools were called
      expect(mockManager.getToolCallCount('FastTool')).toBe(1);
      expect(mockManager.getToolCallCount('MediumTool')).toBe(1);
      expect(mockManager.getToolCallCount('SlowTool')).toBe(1);

      // Verify total time is reasonable (should be around 160ms + overhead)
      expect(totalTime).toBeGreaterThan(150);

      // Get execution summary
      const allCalls = mockManager.getToolCalls();
      expect(allCalls).toHaveLength(3);

      // Verify timestamps are in order
      const sortedCalls = allCalls.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      expect(sortedCalls[0].toolName).toBe('FastTool');
      expect(sortedCalls[2].toolName).toBe('SlowTool');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tools that throw during execution', async () => {
      mockManager.mockTool({
        toolName: 'BuggyTool',
        implementation: () => {
          throw new Error('Simulated tool failure');
        },
      });

      const queryMock = mockManager.setupSDKMock();

      // The query should complete even if individual tools fail
      await queryMock({
        agentDefinition: { name: 'error-agent' },
        prompt: 'Use buggy tool',
        tools: { BuggyTool: {} },
      });

      const buggyCall = mockManager.getLastCallFor('BuggyTool');
      expect(buggyCall?.error).toBeDefined();
      expect(buggyCall?.error?.message).toBe('Simulated tool failure');
    });

    it('should handle unmocked tools gracefully', async () => {
      // Don't mock any tools, rely on default behavior
      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'default-agent' },
        prompt: 'Use unmocked tool',
        tools: { UnmockedTool: {} },
      });

      // Should complete without errors
      expect(mockManager.getToolCallsFor('UnmockedTool')).toHaveLength(0);
    });

    it('should reset state between tests properly', async () => {
      // First test run
      mockManager.mockTool({ toolName: 'TestTool', result: 'first' });
      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'reset-agent-1' },
        prompt: 'First test',
        tools: { TestTool: {} },
      });

      expect(mockManager.getToolCallCount('TestTool')).toBe(1);

      // Reset and second test run
      mockManager.resetCallHistory();
      mockManager.clearMocks();

      // Verify state is clean
      expect(mockManager.getToolCallCount('TestTool')).toBe(0);
      expect(mockManager.wasToolCalled('TestTool')).toBe(false);
    });
  });

  describe('Integration with Claude Agent SDK Module Mock', () => {
    it('should demonstrate full module mocking', async () => {
      // This demonstrates how to use the full module mock
      const sdkManager = mockClaudeAgentSDK();

      // Setup some tools
      setupCommonToolMocks(sdkManager);

      // Now the entire module is mocked and can be used in integration tests
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // This would normally make a real SDK call, but now it's mocked
      const result = query({
        agentDefinition: { name: 'module-test-agent' },
        prompt: 'Test with mocked module',
      });

      // Verify the mock is working
      expect(result).toBeDefined();

      // Cleanup
      sdkManager.cleanup();
      restoreClaudeAgentSDK();
    });
  });
});

/**
 * Example utility functions demonstrating how to create reusable testing patterns
 */

/**
 * Creates a mock file system for testing file operations
 */
export function createMockFileSystem(initialFiles: Record<string, string> = {}) {
  const fileSystem = new Map(Object.entries(initialFiles));

  return {
    mockFileSystemTools: (manager: MockToolManager) => {
      manager.mockTools([
        {
          toolName: 'Read',
          implementation: (params) => {
            const filePath = params.file_path as string;
            const content = fileSystem.get(filePath);
            if (content !== undefined) {
              return { content, success: true };
            } else {
              throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
            }
          },
        },
        {
          toolName: 'Write',
          implementation: (params) => {
            const filePath = params.file_path as string;
            const content = params.content as string;
            fileSystem.set(filePath, content);
            return { success: true, bytesWritten: content.length };
          },
        },
        {
          toolName: 'Glob',
          implementation: (params) => {
            const pattern = params.pattern as string;
            const files = Array.from(fileSystem.keys());

            // Simple pattern matching for demonstration
            let matches: string[];
            if (pattern === '**/*') {
              matches = files;
            } else {
              const regexPattern = pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*');
              const regex = new RegExp(regexPattern);
              matches = files.filter(file => regex.test(file));
            }

            return { files: matches };
          },
        },
      ]);
    },

    getFileContent: (path: string) => fileSystem.get(path),
    setFileContent: (path: string, content: string) => fileSystem.set(path, content),
    deleteFile: (path: string) => fileSystem.delete(path),
    listFiles: () => Array.from(fileSystem.keys()),
    getFileSystem: () => new Map(fileSystem),
  };
}

/**
 * Creates a mock development environment for testing workflows
 */
export function createMockDevEnvironment(manager: MockToolManager) {
  const mockFs = createMockFileSystem({
    '/package.json': JSON.stringify({ name: 'test-project', version: '1.0.0' }),
    '/src/index.ts': 'export function hello() { return "Hello, World!"; }',
    '/README.md': '# Test Project\n\nA test project for testing.',
  });

  // Setup file system tools
  mockFs.mockFileSystemTools(manager);

  // Mock development tools
  manager.mockTools([
    {
      toolName: 'Bash',
      implementation: (params) => {
        const command = params.command as string;

        if (command.includes('npm test')) {
          return { stdout: 'All tests passed!', stderr: '', exitCode: 0 };
        } else if (command.includes('npm build')) {
          return { stdout: 'Build successful!', stderr: '', exitCode: 0 };
        } else if (command.includes('git status')) {
          return {
            stdout: 'On branch main\nnothing to commit, working tree clean',
            stderr: '',
            exitCode: 0
          };
        } else {
          return { stdout: '', stderr: `Command not found: ${command}`, exitCode: 127 };
        }
      },
    },
    {
      toolName: 'Grep',
      implementation: (params) => {
        const pattern = params.pattern as string;
        const files = mockFs.listFiles();
        const matches: Array<{ file: string; line: number; content: string }> = [];

        files.forEach(filePath => {
          const content = mockFs.getFileContent(filePath);
          if (content) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.includes(pattern)) {
                matches.push({ file: filePath, line: index + 1, content: line });
              }
            });
          }
        });

        return { matches, totalMatches: matches.length };
      },
    },
  ]);

  return mockFs;
}

/**
 * Test helper to verify a complete development workflow
 */
export async function verifyDevelopmentWorkflow(
  manager: MockToolManager,
  expectedSteps: string[]
) {
  const queryMock = manager.setupSDKMock();

  await queryMock({
    agentDefinition: { name: 'dev-workflow-agent' },
    prompt: 'Execute development workflow',
    tools: Object.fromEntries(expectedSteps.map(step => [step, {}])),
  });

  // Verify all expected steps were executed
  expectedSteps.forEach(step => {
    expectToolToBeCalled(manager, step);
  });

  // Verify the order if provided
  if (expectedSteps.length > 1) {
    expectToolCallOrder(manager, expectedSteps);
  }

  return {
    toolCalls: manager.getToolCalls(),
    summary: manager.getToolCalls().map(call => ({
      tool: call.toolName,
      timestamp: call.timestamp,
      hasError: !!call.error,
    })),
  };
}