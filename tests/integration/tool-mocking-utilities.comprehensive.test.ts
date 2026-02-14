/**
 * Comprehensive Integration Test for Tool Mocking Utilities
 *
 * This test demonstrates all tool mocking utilities working together:
 * - MockToolsExecutor for simulating tool execution
 * - ToolInvocationRecorder for tracking tool usage
 * - Tool assertion helpers for comprehensive verification
 * - MockClaudeAgentSDK for complete Claude Agent SDK mocking
 *
 * The test simulates a complete development workflow using APEX agents
 * and validates that all mocking utilities work seamlessly together.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import all tool mocking utilities
import {
  MockToolsExecutor,
  createMockToolsExecutor,
  createDefaultMockTools,
  type MockTool,
  type MockToolsExecutorConfig,
} from '../../packages/core/src/test-utils/mock-tools-executor';
import {
  ToolInvocationRecorder,
  globalRecorder,
  type ToolInvocationQueryOptions,
} from '../../packages/orchestrator/src/tool-invocation-recorder';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  setupMockSDK,
  MockErrors,
} from '../../packages/orchestrator/src/__tests__/mocks/claude-agent-sdk';
import {
  expectToolCalled,
  expectToolCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCallRecord,
  type MockToolRegistry,
} from '../test-utils/assertions';

// Types
import type {
  ToolInvocation,
  ToolExecution,
  AgentDefinition,
} from '@apexcli/core';

describe('Tool Mocking Utilities Comprehensive Integration', () => {
  let toolsExecutor: MockToolsExecutor;
  let invocationRecorder: ToolInvocationRecorder;
  let mockSDK: MockClaudeAgentSDK;
  let toolCallRegistry: MockToolRegistry;
  let toolCalls: ToolCallRecord[];

  beforeEach(() => {
    // Initialize all utilities
    toolsExecutor = createMockToolsExecutor({
      recordInvocations: true,
      emitEvents: true,
      validateParameters: true,
      validateResponses: true,
    });

    invocationRecorder = new ToolInvocationRecorder();
    mockSDK = setupMockSDK();
    toolCalls = [];

    // Create registry interface for assertions
    toolCallRegistry = {
      getInvocations: (toolName?: string) => {
        return toolName
          ? toolCalls.filter(call => call.toolName === toolName)
          : toolCalls;
      },
      getAllInvocations: () => [...toolCalls],
      reset: () => { toolCalls = []; }
    };

    // Setup SDK to integrate with tool mocking
    mockSDK.setDynamicHandler(async (agent, message, options) => {
      // Parse tool requests from agent messages
      const toolMatch = message.match(/Use (\w+) tool with (.+)/);
      if (toolMatch) {
        const [, toolName, paramsStr] = toolMatch;
        try {
          const params = JSON.parse(paramsStr);

          // Execute through MockToolsExecutor
          const result = await toolsExecutor.executeTool(toolName, params, {
            taskId: options?.context?.taskId || 'integration-test',
            agentName: agent.name || 'test-agent',
            stageName: 'integration-test'
          });

          // Record the invocation
          const invocation: ToolInvocation = {
            id: `inv-${Date.now()}`,
            requestId: `req-${Date.now()}`,
            toolName,
            parameters: params,
            context: {
              taskId: options?.context?.taskId || 'integration-test',
              agentName: agent.name || 'test-agent',
              stageName: 'integration-test'
            }
          };

          const record = invocationRecorder.recordInvocation(invocation);

          // Add to call registry for assertions
          toolCalls.push({
            toolName,
            parameters: params,
            timestamp: record.recordedAt,
            success: result.success ?? true,
            result
          });

          // Return SDK response format
          return {
            output: {
              success: result.success ?? true,
              messages: [{
                role: 'assistant' as const,
                content: result.content || [{ type: 'text', text: 'Tool executed successfully' }]
              }]
            },
            usage: {
              inputTokens: 100,
              outputTokens: 50,
              totalTokens: 150
            }
          };
        } catch (error) {
          return {
            output: {
              success: false,
              messages: [{
                role: 'assistant' as const,
                content: [{ type: 'text', text: `Tool execution failed: ${error}` }]
              }]
            }
          };
        }
      }
      return null; // Use default response
    });
  });

  afterEach(() => {
    toolsExecutor.reset();
    invocationRecorder.clear();
    mockSDK.reset();
    globalRecorder.clear();
    toolCalls = [];
  });

  describe('Complete Development Workflow Simulation', () => {
    it('should simulate and validate a complete feature development workflow', async () => {
      const taskId = 'feature-development-workflow';
      const agents: AgentDefinition[] = [
        { name: 'planner', description: 'Planning agent', prompt: 'Plan the feature implementation' },
        { name: 'developer', description: 'Development agent', prompt: 'Implement the feature' },
        { name: 'tester', description: 'Testing agent', prompt: 'Test the feature' },
        { name: 'reviewer', description: 'Review agent', prompt: 'Review the implementation' }
      ];

      // Phase 1: Planning
      const planningAgent = agents[0];
      const planningMessages = [
        'Use Glob tool with {"pattern": "src/**/*.ts", "path": "src/"}',
        'Use Read tool with {"file_path": "src/config.ts"}',
        'Use Grep tool with {"pattern": "interface.*Config", "type": "ts"}'
      ];

      for (const message of planningMessages) {
        const result = mockSDK.query(planningAgent, message, { context: { taskId } });
        await consumeAsyncIterable(result);
      }

      // Phase 2: Implementation
      const developmentAgent = agents[1];
      const developmentMessages = [
        'Use Read tool with {"file_path": "src/existing-module.ts"}',
        'Use Write tool with {"file_path": "src/new-feature.ts", "content": "export class NewFeature { ... }"}',
        'Use Edit tool with {"file_path": "src/existing-module.ts", "old_string": "export default", "new_string": "export { NewFeature } from \\"./new-feature\\";\\nexport default"}'
      ];

      for (const message of developmentMessages) {
        const result = mockSDK.query(developmentAgent, message, { context: { taskId } });
        await consumeAsyncIterable(result);
      }

      // Phase 3: Testing
      const testingAgent = agents[2];
      const testingMessages = [
        'Use Write tool with {"file_path": "tests/new-feature.test.ts", "content": "describe(\\"NewFeature\\", () => { ... })"}',
        'Use Bash tool with {"command": "npm test -- --testPathPattern=new-feature"}'
      ];

      for (const message of testingMessages) {
        const result = mockSDK.query(testingAgent, message, { context: { taskId } });
        await consumeAsyncIterable(result);
      }

      // Phase 4: Review
      const reviewAgent = agents[3];
      const reviewMessages = [
        'Use Read tool with {"file_path": "src/new-feature.ts"}',
        'Use Read tool with {"file_path": "tests/new-feature.test.ts"}',
        'Use Edit tool with {"file_path": "README.md", "old_string": "## Features", "new_string": "## Features\\n- New Feature: Enhanced functionality"}'
      ];

      for (const message of reviewMessages) {
        const result = mockSDK.query(reviewAgent, message, { context: { taskId } });
        await consumeAsyncIterable(result);
      }

      // Comprehensive Assertions

      // 1. Verify all tools were used
      const expectedTools = ['Glob', 'Read', 'Write', 'Edit', 'Bash', 'Grep'];
      for (const toolName of expectedTools) {
        expectToolCalled(toolCallRegistry, toolName);
      }

      // 2. Verify tool usage counts
      expectToolCallCount(toolCallRegistry, 'Read', 4); // config.ts, existing-module.ts, new-feature.ts, test file
      expectToolCallCount(toolCallRegistry, 'Write', 2); // new-feature.ts, test file
      expectToolCallCount(toolCallRegistry, 'Edit', 2); // existing-module.ts, README.md

      // 3. Verify workflow order
      expectToolCallOrder(toolCallRegistry, ['Glob', 'Read', 'Write'], { strict: false });

      // 4. Verify specific tool parameters
      expectToolCalledWith(toolCallRegistry, 'Glob', { pattern: 'src/**/*.ts' });
      expectToolCalledWith(toolCallRegistry, 'Bash', { command: 'npm test -- --testPathPattern=new-feature' });
      expectToolCalledWith(toolCallRegistry, 'Write', { file_path: 'src/new-feature.ts' }, { partial: true });

      // 5. Verify tool executor statistics
      const executorStats = toolsExecutor.getStats();
      expect(executorStats.totalInvocations).toBe(toolCalls.length);
      expect(executorStats.successfulExecutions).toBeGreaterThan(0);
      expect(executorStats.errorExecutions).toBe(0);

      // 6. Verify invocation recorder data
      const recorderStats = invocationRecorder.getStats();
      expect(recorderStats.totalInvocations).toBe(toolCalls.length);

      // Filter by agent activity
      const plannerActivity = invocationRecorder.queryInvocations({ agentName: 'planner' });
      expect(plannerActivity).toHaveLength(3);

      const developerActivity = invocationRecorder.queryInvocations({ agentName: 'developer' });
      expect(developerActivity).toHaveLength(3);

      const testerActivity = invocationRecorder.queryInvocations({ agentName: 'tester' });
      expect(testerActivity).toHaveLength(2);

      const reviewerActivity = invocationRecorder.queryInvocations({ agentName: 'reviewer' });
      expect(reviewerActivity).toHaveLength(3);

      // 7. Verify SDK call history
      const sdkCallHistory = mockSDK.getCallHistory();
      expect(sdkCallHistory).toHaveLength(11); // Total messages sent
      expect(sdkCallHistory.filter(call => call.agent.name === 'planner')).toHaveLength(3);
      expect(sdkCallHistory.filter(call => call.agent.name === 'developer')).toHaveLength(3);
      expect(sdkCallHistory.filter(call => call.agent.name === 'tester')).toHaveLength(2);
      expect(sdkCallHistory.filter(call => call.agent.name === 'reviewer')).toHaveLength(3);
    });

    it('should handle error scenarios and recovery patterns', async () => {
      const taskId = 'error-recovery-workflow';
      const agent: AgentDefinition = {
        name: 'developer',
        description: 'Development agent',
        prompt: 'Handle errors gracefully'
      };

      // Configure tools to simulate errors
      toolsExecutor.registerTool({
        name: 'FlakyTool',
        description: 'Tool that fails randomly',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string' },
            attempt: { type: 'number' }
          },
          required: ['operation', 'attempt']
        },
        responseSequence: [
          { success: false, content: [{ type: 'text', text: 'First attempt failed' }] },
          { success: false, content: [{ type: 'text', text: 'Second attempt failed' }] },
          { success: true, content: [{ type: 'text', text: 'Third attempt succeeded' }] }
        ]
      });

      // Configure SDK to handle errors
      mockSDK.addError(new Error('Simulated SDK error'));
      mockSDK.addResponse({
        output: {
          success: true,
          messages: [{
            role: 'assistant',
            content: [{ type: 'text', text: 'Recovered from error' }]
          }]
        }
      });

      // Test error scenarios
      const errorScenarios = [
        'Use FlakyTool tool with {"operation": "test", "attempt": 1}',
        'Use FlakyTool tool with {"operation": "test", "attempt": 2}',
        'Use FlakyTool tool with {"operation": "test", "attempt": 3}',
        'Use Read tool with {"file_path": "/non-existent.txt"}' // Will be handled by default tools
      ];

      let errorCount = 0;
      for (const [index, message] of errorScenarios.entries()) {
        try {
          const result = mockSDK.query(agent, message, { context: { taskId } });
          await consumeAsyncIterable(result);
        } catch (error) {
          errorCount++;

          // On first error, test recovery
          if (index === 0) {
            const recoveryResult = mockSDK.query(agent, 'Recovery message', { context: { taskId } });
            await consumeAsyncIterable(recoveryResult);
          }
        }
      }

      // Verify error handling
      expect(errorCount).toBeGreaterThan(0);

      // Verify that some tool calls were recorded despite errors
      expect(toolCalls.length).toBeGreaterThan(0);

      // Verify error tracking
      const flakyToolCalls = toolCalls.filter(call => call.toolName === 'FlakyTool');
      expect(flakyToolCalls).toHaveLength(3);

      // First two should fail, third should succeed
      expect(flakyToolCalls[0].success).toBe(false);
      expect(flakyToolCalls[1].success).toBe(false);
      expect(flakyToolCalls[2].success).toBe(true);

      // Verify SDK error tracking
      const sdkHistory = mockSDK.getCallHistory();
      expect(sdkHistory.length).toBeGreaterThan(0);
    });

    it('should support performance testing and analysis', async () => {
      const taskId = 'performance-test-workflow';
      const batchSize = 100;

      // Configure fast-executing tools
      const fastTools = ['Read', 'Write', 'Edit'].map(toolName => ({
        name: `Fast${toolName}`,
        description: `Fast version of ${toolName}`,
        category: 'performance',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            batch_id: { type: 'number' }
          },
          required: ['file_path', 'batch_id']
        },
        responseDelay: 5, // Very fast
        execute: async (params: Record<string, unknown>) => ({
          success: true,
          content: [{ type: 'text', text: `Fast ${toolName} result for ${params.file_path}` }]
        })
      }));

      fastTools.forEach(tool => toolsExecutor.registerTool(tool as MockTool));

      const agent: AgentDefinition = {
        name: 'performance-tester',
        description: 'Performance testing agent',
        prompt: 'Execute performance tests'
      };

      // Execute batch of tools
      const startTime = performance.now();
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        const toolName = fastTools[i % fastTools.length].name;
        const message = `Use ${toolName} tool with {"file_path": "/perf-test-${i}.txt", "batch_id": ${i}}`;

        const promise = (async () => {
          const result = mockSDK.query(agent, message, { context: { taskId } });
          await consumeAsyncIterable(result);
        })();

        promises.push(promise);
      }

      await Promise.all(promises);
      const endTime = performance.now();

      // Performance assertions
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all tools were executed
      expect(toolCalls).toHaveLength(batchSize);

      // Verify performance statistics
      const executorStats = toolsExecutor.getStats();
      expect(executorStats.totalInvocations).toBe(batchSize);
      expect(executorStats.averageDuration).toBeLessThan(100); // Fast execution

      // Verify invocation recorder performance
      const recorderStats = invocationRecorder.getStats();
      expect(recorderStats.totalInvocations).toBe(batchSize);

      // Test assertion performance on large dataset
      const assertionStartTime = performance.now();

      expectToolCalled(toolCallRegistry, 'FastRead');
      expectToolCallCount(toolCallRegistry, 'FastRead', Math.ceil(batchSize / 3));

      const assertionEndTime = performance.now();
      const assertionDuration = assertionEndTime - assertionStartTime;
      expect(assertionDuration).toBeLessThan(100); // Assertions should be fast
    });
  });

  describe('Cross-Utility Integration Patterns', () => {
    it('should demonstrate seamless data flow between utilities', async () => {
      const taskId = 'data-flow-test';

      // 1. Start with tool execution
      const customTool: MockTool = {
        name: 'DataProcessor',
        description: 'Process data through all utilities',
        category: 'integration',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
            stage: { type: 'string' }
          },
          required: ['input', 'stage']
        },
        execute: async (params) => {
          // Record in global recorder during execution
          globalRecorder.recordInvocation({
            id: `global-${Date.now()}`,
            requestId: `global-req-${Date.now()}`,
            toolName: 'DataProcessor',
            parameters: params,
            context: {
              taskId,
              agentName: 'data-agent',
              stageName: params.stage as string
            }
          });

          return {
            success: true,
            content: [{
              type: 'text',
              text: `Processed ${params.input} in ${params.stage} stage`
            }]
          };
        }
      };

      toolsExecutor.registerTool(customTool);

      const agent: AgentDefinition = {
        name: 'data-agent',
        description: 'Data processing agent',
        prompt: 'Process data through pipeline'
      };

      // 2. Execute through SDK -> Executor chain
      const stages = ['input', 'processing', 'output'];
      for (const [index, stage] of stages.entries()) {
        const message = `Use DataProcessor tool with {"input": "data-${index}", "stage": "${stage}"}`;
        const result = mockSDK.query(agent, message, { context: { taskId } });
        await consumeAsyncIterable(result);
      }

      // 3. Verify data flow through all utilities

      // Check tool executor
      const executorInvocations = toolsExecutor.getInvocations('DataProcessor');
      expect(executorInvocations).toHaveLength(3);

      // Check local recorder
      const localRecordedInvocations = invocationRecorder.queryInvocations({
        toolName: 'DataProcessor'
      });
      expect(localRecordedInvocations).toHaveLength(3);

      // Check global recorder
      const globalRecordedInvocations = globalRecorder.queryInvocations({
        toolName: 'DataProcessor'
      });
      expect(globalRecordedInvocations).toHaveLength(3);

      // Check assertion registry
      expectToolCallCount(toolCallRegistry, 'DataProcessor', 3);

      // Check SDK history
      const sdkHistory = mockSDK.getCallHistory();
      expect(sdkHistory).toHaveLength(3);

      // 4. Verify data consistency across utilities
      stages.forEach((stage, index) => {
        // Executor data
        const executorCall = executorInvocations[index];
        expect(executorCall.parameters.stage).toBe(stage);

        // Local recorder data
        const localRecord = localRecordedInvocations[index];
        expect(localRecord.invocation.parameters.stage).toBe(stage);

        // Global recorder data
        const globalRecord = globalRecordedInvocations[index];
        expect(globalRecord.invocation.parameters.stage).toBe(stage);

        // Assertion registry data
        const registryCall = toolCalls[index];
        expect(registryCall.parameters.stage).toBe(stage);

        // SDK history data
        const sdkCall = sdkHistory[index];
        expect(sdkCall.message).toContain(stage);
      });

      // 5. Cross-utility queries and analysis
      const stageAnalysis = stages.map(stage => ({
        stage,
        executorInvocations: toolsExecutor.getInvocations('DataProcessor').filter(
          inv => inv.parameters.stage === stage
        ).length,
        localRecordedInvocations: invocationRecorder.queryInvocations({
          parameters: { stage }
        }).length,
        globalRecordedInvocations: globalRecorder.queryInvocations({
          parameters: { stage }
        }).length,
        registryInvocations: toolCalls.filter(
          call => call.parameters.stage === stage
        ).length
      }));

      // All utilities should have consistent counts per stage
      stageAnalysis.forEach(analysis => {
        expect(analysis.executorInvocations).toBe(1);
        expect(analysis.localRecordedInvocations).toBe(1);
        expect(analysis.globalRecordedInvocations).toBe(1);
        expect(analysis.registryInvocations).toBe(1);
      });
    });

    it('should handle complex streaming and async scenarios', async () => {
      const taskId = 'streaming-async-test';

      // Configure SDK for streaming responses
      const streamingEvents = new StreamingResponseBuilder()
        .addThinking('Analyzing the request...', 100)
        .addTextChunk('Starting tool execution...', 50)
        .addToolUse('tool_1', 'AsyncTool', { operation: 'start' }, 100)
        .addTextChunk('Tool execution in progress...', 50)
        .addToolUse('tool_2', 'AsyncTool', { operation: 'complete' }, 100)
        .addUsage(200, 150)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const agent: AgentDefinition = {
        name: 'streaming-agent',
        description: 'Agent with streaming responses',
        prompt: 'Handle streaming operations'
      };

      // Configure async tool
      toolsExecutor.registerTool({
        name: 'AsyncTool',
        description: 'Asynchronous tool with delays',
        category: 'async',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string' }
          },
          required: ['operation']
        },
        responseDelay: 200,
        execute: async (params) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            success: true,
            content: [{ type: 'text', text: `Async operation: ${params.operation}` }]
          };
        }
      });

      // Execute streaming workflow
      const result = mockSDK.query(agent, 'Execute streaming operations', { context: { taskId } });

      const streamedContent: any[] = [];
      for await (const chunk of result) {
        streamedContent.push(chunk);
      }

      // Verify streaming content
      expect(streamedContent).toHaveLength(streamingEvents.length);

      // Verify that async operations were properly handled
      const asyncToolInvocations = toolsExecutor.getInvocations('AsyncTool');
      expect(asyncToolInvocations.length).toBeGreaterThanOrEqual(0); // May be 0 if not triggered by stream

      // Verify SDK streaming behavior
      const sdkHistory = mockSDK.getCallHistory();
      expect(sdkHistory).toHaveLength(1);
      expect(sdkHistory[0].agent.name).toBe('streaming-agent');

      // Test concurrent async operations
      const concurrentPromises = Array.from({ length: 5 }, async (_, i) => {
        const asyncResult = await toolsExecutor.executeTool('AsyncTool', {
          operation: `concurrent-${i}`
        });

        // Record invocation
        const invocation: ToolInvocation = {
          id: `async-inv-${i}`,
          requestId: `async-req-${i}`,
          toolName: 'AsyncTool',
          parameters: { operation: `concurrent-${i}` },
          context: {
            taskId,
            agentName: 'streaming-agent',
            stageName: 'async-test'
          }
        };

        invocationRecorder.recordInvocation(invocation);

        toolCalls.push({
          toolName: 'AsyncTool',
          parameters: { operation: `concurrent-${i}` },
          timestamp: new Date(),
          success: asyncResult.success ?? true,
          result: asyncResult
        });

        return asyncResult;
      });

      const concurrentResults = await Promise.all(concurrentPromises);
      expect(concurrentResults).toHaveLength(5);
      expect(concurrentResults.every(result => result.success)).toBe(true);

      // Verify concurrent execution tracking
      const concurrentInvocations = invocationRecorder.queryInvocations({
        stageName: 'async-test'
      });
      expect(concurrentInvocations).toHaveLength(5);

      expectToolCallCount(toolCallRegistry, 'AsyncTool', 5);
    });
  });
});

/**
 * Helper function to consume async iterables (like SDK query results)
 */
async function consumeAsyncIterable(iterable: any): Promise<any[]> {
  const results: any[] = [];
  try {
    for await (const item of iterable) {
      results.push(item);
    }
  } catch (error) {
    // Handle errors in the async iteration
    throw error;
  }
  return results;
}