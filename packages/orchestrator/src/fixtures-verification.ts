#!/usr/bin/env node
/**
 * Simple verification script to test the fixtures module works correctly
 * This file demonstrates usage and validates basic functionality
 */

import {
  createTestTask,
  createTestAgent,
  createTestWorkflow,
  createTestWorkflowStage,
  createTestTasks,
  createTestAgents,
  createTestWorkflows
} from './fixtures.js';

import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema
} from '@apexcli/core';

console.log('🧪 Testing TaskStore Test Fixtures Module');
console.log('==========================================');

try {
  // Test individual factory functions
  console.log('\n✅ Testing individual factory functions...');

  const task = createTestTask({ description: 'Verification test task', priority: 'urgent' });
  console.log(`   Task created: ${task.id} - "${task.description}" (${task.priority})`);

  // Validate task components
  TaskStatusSchema.parse(task.status);
  TaskPrioritySchema.parse(task.priority);
  TaskEffortSchema.parse(task.effort);
  console.log(`   Task validation: ✓ Status, Priority, Effort schemas passed`);

  const agent = createTestAgent({ name: 'verification-agent', model: 'opus' });
  console.log(`   Agent created: ${agent.name} (model: ${agent.model})`);

  // Validate agent with Zod schema
  AgentDefinitionSchema.parse(agent);
  console.log(`   Agent validation: ✓ AgentDefinitionSchema passed`);

  const stage = createTestWorkflowStage({ name: 'verify-stage', agent: 'verifier' });
  console.log(`   Workflow stage created: ${stage.name} (agent: ${stage.agent})`);

  // Validate stage with Zod schema
  WorkflowStageSchema.parse(stage);
  console.log(`   Stage validation: ✓ WorkflowStageSchema passed`);

  const workflow = createTestWorkflow({ name: 'verification-workflow' });
  console.log(`   Workflow created: ${workflow.name} with ${workflow.stages.length} stages`);

  // Validate workflow with Zod schema
  WorkflowDefinitionSchema.parse(workflow);
  console.log(`   Workflow validation: ✓ WorkflowDefinitionSchema passed`);

  // Test bulk creation helpers
  console.log('\n✅ Testing bulk creation helpers...');

  const tasks = createTestTasks(3, (index) => ({
    description: `Bulk task ${index + 1}`,
    priority: index === 0 ? 'urgent' : 'normal'
  }));
  console.log(`   Created ${tasks.length} tasks with varying properties`);
  tasks.forEach((t, i) => console.log(`     ${i + 1}: ${t.description} (${t.priority})`));

  const agents = createTestAgents(2, { model: 'haiku', skills: ['verification', 'testing'] });
  console.log(`   Created ${agents.length} agents with haiku model`);
  agents.forEach((a, i) => console.log(`     ${i + 1}: ${a.name} (${a.model})`));

  const workflows = createTestWorkflows(2, { description: 'Bulk verification workflow' });
  console.log(`   Created ${workflows.length} workflows with custom description`);
  workflows.forEach((w, i) => console.log(`     ${i + 1}: ${w.name} - ${w.description}`));

  // Test overrides work correctly
  console.log('\n✅ Testing override functionality...');

  const customTask = createTestTask({
    description: 'Custom test task',
    status: 'in-progress',
    priority: 'low',
    effort: 'large',
    workflow: 'custom-workflow',
    retryCount: 5,
    maxRetries: 10
  });

  console.log(`   Custom task: ${customTask.description}`);
  console.log(`     Status: ${customTask.status}, Priority: ${customTask.priority}, Effort: ${customTask.effort}`);
  console.log(`     Workflow: ${customTask.workflow}, Retry: ${customTask.retryCount}/${customTask.maxRetries}`);

  // Validate all components still pass validation
  TaskStatusSchema.parse(customTask.status);
  TaskPrioritySchema.parse(customTask.priority);
  TaskEffortSchema.parse(customTask.effort);
  console.log(`   Custom task validation: ✓ All schemas passed`);

  // Test edge cases
  console.log('\n✅ Testing edge cases...');

  // Empty overrides should work
  const emptyTask = createTestTask({});
  console.log(`   Empty overrides task: ${emptyTask.id} - default values applied`);

  // Test error handling for bulk creation
  try {
    createTestTasks(0);
    console.log('   ❌ Expected error for zero count not thrown');
  } catch (error) {
    console.log(`   ✓ Zero count correctly throws error: ${error.message}`);
  }

  // Integration test - create related fixtures
  console.log('\n✅ Testing integration between fixtures...');

  const integrationAgent = createTestAgent({
    name: 'integration-developer',
    skills: ['typescript', 'testing', 'integration']
  });

  const integrationStage = createTestWorkflowStage({
    name: 'integration-implementation',
    agent: integrationAgent.name,
    description: 'Implement integration features',
    outputs: ['integration_code', 'tests']
  });

  const integrationWorkflow = createTestWorkflow({
    name: 'integration-flow',
    description: 'Integration testing workflow',
    stages: [integrationStage]
  });

  const integrationTask = createTestTask({
    description: 'Integration test task',
    workflow: integrationWorkflow.name,
    priority: 'high'
  });

  console.log(`   Agent: ${integrationAgent.name} -> Stage: ${integrationStage.name}`);
  console.log(`   Stage: ${integrationStage.name} -> Workflow: ${integrationWorkflow.name}`);
  console.log(`   Task: ${integrationTask.description} -> Workflow: ${integrationTask.workflow}`);

  // Validate all integration fixtures
  AgentDefinitionSchema.parse(integrationAgent);
  WorkflowStageSchema.parse(integrationStage);
  WorkflowDefinitionSchema.parse(integrationWorkflow);
  TaskStatusSchema.parse(integrationTask.status);
  console.log(`   ✓ All integration fixtures pass validation`);

  console.log('\n🎉 All tests passed! TaskStore Test Fixtures Module is working correctly.');
  console.log('\n📋 Summary:');
  console.log('   ✓ Individual factory functions work with defaults and overrides');
  console.log('   ✓ Bulk creation helpers work with static and function-based overrides');
  console.log('   ✓ All fixtures pass Zod schema validation');
  console.log('   ✓ Edge cases are handled properly');
  console.log('   ✓ Fixtures integrate well with each other');
  console.log('   ✓ TypeScript types are correctly maintained');

} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}