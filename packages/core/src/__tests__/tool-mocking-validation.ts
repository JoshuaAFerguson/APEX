/**
 * @fileoverview Tool Mocking Infrastructure Validation
 *
 * This script validates that all tool mocking test files are properly structured
 * and have correct imports and syntax. It serves as a compile-time check
 * for the tool mocking test infrastructure.
 */

// Validate all test imports are working correctly
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Validate core mocking utilities imports
import {
  MockToolExecution,
  MockToolScenarioBuilder,
  createMockToolExecution,
  createMockToolScenario,
  createFileSystemMockTools,
  createShellMockTools,
  createWebMockTools,
  createComprehensiveMockTools,
  type MockToolResponseConfig,
  type CapturedToolCall,
  type MockToolBehavior,
} from '../test-utils/claude-sdk-mock';

import {
  MockToolsExecutor,
  createDefaultMockTools,
  createMockToolsExecutor,
  type MockToolsExecutorConfig,
  type MockToolExecutionStats,
} from '../test-utils/mock-tools-executor';

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolInvocationEvent,
  MockToolExecutor,
} from '../test-utils/mock-tool-types';

/**
 * Validation function to ensure all test utilities are properly exported
 * and can be imported without errors
 */
export function validateToolMockingInfrastructure(): boolean {
  try {
    // Validate MockToolExecution can be instantiated
    const mockExecution = new MockToolExecution();
    if (!(mockExecution instanceof MockToolExecution)) {
      throw new Error('MockToolExecution instantiation failed');
    }

    // Validate MockToolsExecutor can be instantiated
    const mockExecutor = new MockToolsExecutor();
    if (!(mockExecutor instanceof MockToolsExecutor)) {
      throw new Error('MockToolsExecutor instantiation failed');
    }

    // Validate builder pattern
    const builder = new MockToolScenarioBuilder();
    const builtMock = builder.withSuccessTool('TestTool', { test: true }).build();
    if (!(builtMock instanceof MockToolExecution)) {
      throw new Error('MockToolScenarioBuilder failed');
    }

    // Validate factory functions
    const defaultMocks = createDefaultMockTools();
    if (!Array.isArray(defaultMocks) || defaultMocks.length === 0) {
      throw new Error('createDefaultMockTools failed');
    }

    const fsMocks = createFileSystemMockTools();
    if (!(fsMocks instanceof MockToolExecution)) {
      throw new Error('createFileSystemMockTools failed');
    }

    const shellMocks = createShellMockTools();
    if (!(shellMocks instanceof MockToolExecution)) {
      throw new Error('createShellMockTools failed');
    }

    const webMocks = createWebMockTools();
    if (!(webMocks instanceof MockToolExecution)) {
      throw new Error('createWebMockTools failed');
    }

    const comprehensiveMocks = createComprehensiveMockTools();
    if (!(comprehensiveMocks instanceof MockToolExecution)) {
      throw new Error('createComprehensiveMockTools failed');
    }

    // Validate executor factory
    const executorFromFactory = createMockToolsExecutor();
    if (!(executorFromFactory instanceof MockToolsExecutor)) {
      throw new Error('createMockToolsExecutor failed');
    }

    return true;
  } catch (error) {
    console.error('Tool mocking infrastructure validation failed:', error);
    return false;
  }
}

/**
 * Validation for type definitions
 */
export function validateMockingTypeDefinitions(): boolean {
  // These are compile-time checks - if this compiles, types are correct
  const mockTool: MockTool = {
    name: 'ValidationTool',
    description: 'Tool for type validation',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    },
    execute: async (params) => ({
      success: true,
      content: [{ type: 'text', text: `Validated ${params.input}` }]
    })
  };

  const mockResponse: MockToolResponse = {
    success: true,
    content: [{ type: 'text', text: 'Test response' }]
  };

  const toolInvocation: ToolInvocation = {
    id: 'test-id',
    toolName: 'TestTool',
    parameters: { test: 'param' },
    invokedAt: new Date()
  };

  const executorConfig: MockToolsExecutorConfig = {
    recordInvocations: true,
    emitEvents: true,
    defaultTimeout: 5000,
    validateParameters: true,
    validateResponses: true,
    maxConcurrentExecutions: 10
  };

  // If we reach this point, all types compiled successfully
  return true;
}

/**
 * Test file structure validation
 */
export function validateTestFileStructure(): string[] {
  const issues: string[] = [];

  // Check that all required test files exist by checking exports
  try {
    // Test that we can import from test files (this validates they exist and compile)
    const testModules = [
      '../test-utils/claude-sdk-mock',
      '../test-utils/mock-tools-executor',
      '../test-utils/mock-tool-types',
    ];

    testModules.forEach(modulePath => {
      try {
        require(modulePath);
      } catch (error) {
        issues.push(`Failed to import ${modulePath}: ${error}`);
      }
    });
  } catch (error) {
    issues.push(`Test file structure validation error: ${error}`);
  }

  return issues;
}

/**
 * Main validation function
 */
export function runToolMockingValidation(): boolean {
  console.log('🧪 Validating tool mocking infrastructure...');

  const infrastructureValid = validateToolMockingInfrastructure();
  const typesValid = validateMockingTypeDefinitions();
  const structureIssues = validateTestFileStructure();

  if (infrastructureValid && typesValid && structureIssues.length === 0) {
    console.log('✅ Tool mocking infrastructure validation passed');
    console.log('✅ All imports are working correctly');
    console.log('✅ All factory functions are operational');
    console.log('✅ All type definitions are valid');
    console.log('✅ Test file structure is correct');
    return true;
  } else {
    console.error('❌ Tool mocking infrastructure validation failed');
    if (structureIssues.length > 0) {
      console.error('Structure issues:', structureIssues);
    }
    return false;
  }
}

// Simple test to validate the infrastructure works
describe('Tool Mocking Infrastructure Validation', () => {
  it('should validate all infrastructure components', () => {
    expect(validateToolMockingInfrastructure()).toBe(true);
    expect(validateMockingTypeDefinitions()).toBe(true);
    expect(validateTestFileStructure()).toHaveLength(0);
  });
});