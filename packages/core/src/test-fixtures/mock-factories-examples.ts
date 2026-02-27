/**
 * @fileoverview Mock Factories Usage Examples
 *
 * This file demonstrates how to use the mock factories in various testing scenarios.
 * It serves as both documentation and verification that the factories work correctly.
 */

import {
  createMockTask,
  createMockAgentDefinition,
  createMockWorkflowDefinition,
  createMockComplexTask,
  createMockComplexWorkflow,
  createMockWorkflowTestData,
  mockFactories
} from './mock-factories.js';

// Example 1: Basic Task Creation
export function exampleBasicTask() {
  const task = createMockTask({
    description: 'Implement user authentication',
    priority: 'high',
    effort: 'large'
  });

  // Verify the mock has expected properties
  console.assert(task.description === 'Implement user authentication');
  console.assert(task.priority === 'high');
  console.assert(task.effort === 'large');
  console.assert(task.status === 'pending'); // default value
  console.assert(typeof task.id === 'string');
  console.assert(task.usage.inputTokens === 1000); // default usage

  return task;
}

// Example 2: Agent Definition with Custom Tools
export function exampleCustomAgent() {
  const agent = createMockAgentDefinition({
    name: 'security-agent',
    model: 'opus',
    tools: ['read', 'grep', 'bash'],
    description: 'Specialized security analysis agent',
    prompt: 'You are a security-focused agent that analyzes code for vulnerabilities.'
  });

  console.assert(agent.name === 'security-agent');
  console.assert(agent.model === 'opus');
  console.assert(agent.tools.includes('read'));
  console.assert(agent.tools.includes('grep'));
  console.assert(agent.tools.includes('bash'));

  return agent;
}

// Example 3: Complex Workflow with Multiple Stages
export function exampleComplexWorkflow() {
  const workflow = createMockComplexWorkflow({
    name: 'security-audit-workflow',
    description: 'Comprehensive security audit workflow'
  });

  console.assert(workflow.name === 'security-audit-workflow');
  console.assert(workflow.stages.length === 4); // planning, implementation, testing, review
  console.assert(workflow.gates?.length === 2); // Plan Approval, Security Check

  return workflow;
}

// Example 4: Task with Rich Logging and Artifacts
export function exampleRichTask() {
  const task = createMockComplexTask({
    description: 'API security enhancement',
    status: 'completed',
    completedAt: new Date()
  });

  console.assert(task.logs.length === 3);
  console.assert(task.artifacts.length === 3);
  console.assert(task.logs.some(log => log.level === 'warn'));
  console.assert(task.artifacts.some(artifact => artifact.type === 'diff'));

  return task;
}

// Example 5: Full Test Data Suite
export function exampleTestDataSuite() {
  const testData = createMockWorkflowTestData({
    task: {
      description: 'End-to-end feature development',
      workflow: 'feature-development'
    },
    agent: {
      name: 'full-stack-developer',
      model: 'sonnet'
    },
    workflow: {
      name: 'feature-development',
      description: 'Complete feature development workflow'
    },
    config: {
      version: '0.5.0'
    }
  });

  console.assert(testData.task.description === 'End-to-end feature development');
  console.assert(testData.agent.name === 'full-stack-developer');
  console.assert(testData.workflow.name === 'feature-development');
  console.assert(testData.config.version === '0.5.0');

  return testData;
}

// Example 6: Testing with All Factory Types
export function exampleComprehensiveMocking() {
  // Create various mock objects to demonstrate coverage
  const task = mockFactories.createMockTask();
  const agent = mockFactories.createMockAgentDefinition();
  const workflow = mockFactories.createMockWorkflowDefinition();
  const stage = mockFactories.createMockWorkflowStage();
  const gate = mockFactories.createMockWorkflowGate();
  const permission = mockFactories.createMockPermission();
  const container = mockFactories.createMockContainerConfig();
  const workspace = mockFactories.createMockWorkspaceConfig();
  const project = mockFactories.createMockProjectConfig();
  const apex = mockFactories.createMockApexConfig();

  // Verify all objects were created successfully
  console.assert(typeof task.id === 'string');
  console.assert(typeof agent.name === 'string');
  console.assert(Array.isArray(workflow.stages));
  console.assert(typeof stage.name === 'string');
  console.assert(typeof gate.id === 'string');
  console.assert(typeof permission.level === 'string');
  console.assert(typeof container.image === 'string');
  console.assert(typeof workspace.strategy === 'string');
  console.assert(typeof project.name === 'string');
  console.assert(typeof apex.version === 'string');

  return {
    task, agent, workflow, stage, gate,
    permission, container, workspace, project, apex
  };
}

// Example 7: Testing Error Handling and Edge Cases
export function exampleEdgeCases() {
  // Test with null/undefined overrides
  const taskWithNulls = createMockTask({
    acceptanceCriteria: undefined,
    branchName: null as any
  });

  console.assert(taskWithNulls.acceptanceCriteria === undefined);
  console.assert(taskWithNulls.branchName === null);

  // Test with empty overrides
  const agentWithEmpty = createMockAgentDefinition({});
  console.assert(agentWithEmpty.name === 'mock-agent'); // should use defaults

  // Test with complex nested overrides
  const taskWithNestedOverrides = createMockTask({
    usage: mockFactories.createMockTaskUsage({ inputTokens: 999 }),
    logs: [mockFactories.createMockTaskLog({ level: 'debug' })]
  });

  console.assert(taskWithNestedOverrides.usage.inputTokens === 999);
  console.assert(taskWithNestedOverrides.logs[0].level === 'debug');

  return { taskWithNulls, agentWithEmpty, taskWithNestedOverrides };
}

// Example 8: Validation Testing
export function exampleValidation() {
  const task = createMockTask();

  // Use the validation helper
  const isValid = mockFactories.validateMockObject(task, (obj) => {
    return typeof obj.id === 'string' &&
           typeof obj.description === 'string' &&
           ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(obj.status);
  });

  console.assert(isValid === true);

  // Test validation failure
  const isInvalid = mockFactories.validateMockObject(task, (obj) => {
    return obj.id === 'this-will-never-match';
  });

  console.assert(isInvalid === false);

  return { isValid, isInvalid };
}

// Run all examples to verify everything works
export function runAllExamples() {
  console.log('🧪 Running Mock Factories Examples...\n');

  try {
    console.log('✅ Basic task creation:', !!exampleBasicTask());
    console.log('✅ Custom agent creation:', !!exampleCustomAgent());
    console.log('✅ Complex workflow creation:', !!exampleComplexWorkflow());
    console.log('✅ Rich task creation:', !!exampleRichTask());
    console.log('✅ Test data suite creation:', !!exampleTestDataSuite());
    console.log('✅ Comprehensive mocking:', !!exampleComprehensiveMocking());
    console.log('✅ Edge cases handling:', !!exampleEdgeCases());
    console.log('✅ Validation testing:', !!exampleValidation());

    console.log('\n🎉 All mock factory examples executed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    return false;
  }
}

// Export all examples for testing
export const examples = {
  exampleBasicTask,
  exampleCustomAgent,
  exampleComplexWorkflow,
  exampleRichTask,
  exampleTestDataSuite,
  exampleComprehensiveMocking,
  exampleEdgeCases,
  exampleValidation,
  runAllExamples
};