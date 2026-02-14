/**
 * Usage examples for ToolInvocationRecorder
 *
 * This file demonstrates how to use the ToolInvocationRecorder for capturing
 * and analyzing tool invocations during testing and development.
 */

import {
  ToolInvocationRecorder,
  globalRecorder,
  type ToolInvocationQueryOptions,
} from '../tool-invocation-recorder.js';
import type { ToolInvocation, ToolExecution } from '@apexcli/core';

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Example 1: Basic recording and querying
 */
function basicUsageExample() {
  const recorder = new ToolInvocationRecorder();

  // Record a tool invocation
  const invocation: ToolInvocation = {
    toolName: 'Read',
    parameters: { file_path: '/src/example.ts' },
    requestId: 'req-123',
    context: {
      taskId: 'task-feature-dev',
      agentName: 'developer',
      stageName: 'implementation',
    },
  };

  const record = recorder.recordInvocation(invocation);
  console.log('Recorded invocation:', record.recordedAt);

  // Record execution results
  const execution: ToolExecution = {
    callId: 'call-123',
    toolName: 'Read',
    input: { file_path: '/src/example.ts' },
    taskId: 'task-feature-dev',
    agentName: 'developer',
    stageName: 'implementation',
    startTime: new Date(),
    endTime: new Date(),
    duration: 150,
    status: 'completed',
    result: {
      success: true,
      output: 'export function example() { return "hello"; }',
    },
  };

  recorder.recordExecution('req-123', execution);

  // Query recorded invocations
  const readInvocations = recorder.queryInvocations({ toolName: 'Read' });
  console.log('Read tool invocations:', readInvocations.length);

  // Get statistics
  const stats = recorder.getStats();
  console.log('Statistics:', stats);

  return recorder;
}

/**
 * Example 2: Testing with recorder - test setup/teardown pattern
 */
function testingExample() {
  // Using a local recorder for test isolation
  let testRecorder: ToolInvocationRecorder;

  // Test setup
  function beforeEach() {
    testRecorder = new ToolInvocationRecorder();
  }

  // Test teardown
  function afterEach() {
    testRecorder.clear();
  }

  // Simulate a test
  function testFileOperations() {
    beforeEach();

    // Record file operations during test
    testRecorder.recordInvocation({
      toolName: 'Read',
      parameters: { file_path: '/test/config.json' },
      context: { taskId: 'test-task' },
    });

    testRecorder.recordInvocation({
      toolName: 'Write',
      parameters: { file_path: '/test/output.json', content: '{"status": "ok"}' },
      context: { taskId: 'test-task' },
    });

    // Verify operations
    const fileOps = testRecorder.queryInvocations({
      taskId: 'test-task',
    });

    console.assert(fileOps.length === 2, 'Expected 2 file operations');
    console.assert(
      fileOps.some(op => op.invocation.toolName === 'Read'),
      'Expected Read operation'
    );
    console.assert(
      fileOps.some(op => op.invocation.toolName === 'Write'),
      'Expected Write operation'
    );

    afterEach();
  }

  testFileOperations();
}

/**
 * Example 3: Using global recorder for application-wide monitoring
 */
function globalRecorderExample() {
  // Record application tool usage
  globalRecorder.recordInvocation({
    toolName: 'Bash',
    parameters: { command: 'npm install' },
    context: {
      taskId: 'setup-project',
      agentName: 'devops',
      stageName: 'initialization',
    },
  });

  globalRecorder.recordInvocation({
    toolName: 'Bash',
    parameters: { command: 'npm test' },
    context: {
      taskId: 'setup-project',
      agentName: 'devops',
      stageName: 'validation',
    },
  });

  // Analyze usage patterns
  const stats = globalRecorder.getStats();
  console.log('Application tool usage statistics:');
  console.log('- Total invocations:', stats.totalInvocations);
  console.log('- Top tools:', stats.topTools);

  // Query by agent
  const devopsInvocations = globalRecorder.queryInvocations({
    agentName: 'devops',
  });
  console.log('DevOps agent tool usage:', devopsInvocations.length);

  // Reset for next application session
  globalRecorder.reset();
}

/**
 * Example 4: Advanced querying and filtering
 */
function advancedQueryingExample() {
  const recorder = new ToolInvocationRecorder();

  // Record various tool invocations with different contexts
  const invocations = [
    {
      toolName: 'Read',
      parameters: { file_path: '/src/utils.ts' },
      context: { taskId: 'refactor-utils', agentName: 'developer', stageName: 'analysis' },
    },
    {
      toolName: 'Edit',
      parameters: { file_path: '/src/utils.ts', old_string: 'old code', new_string: 'new code' },
      context: { taskId: 'refactor-utils', agentName: 'developer', stageName: 'implementation' },
    },
    {
      toolName: 'Bash',
      parameters: { command: 'npm test src/utils.test.ts' },
      context: { taskId: 'refactor-utils', agentName: 'tester', stageName: 'validation' },
    },
    {
      toolName: 'Read',
      parameters: { file_path: '/src/app.ts' },
      context: { taskId: 'add-feature', agentName: 'developer', stageName: 'analysis' },
    },
  ];

  invocations.forEach(inv => recorder.recordInvocation(inv));

  // Complex queries
  console.log('\n=== Advanced Querying Examples ===');

  // 1. Find all file read operations
  const readOps = recorder.queryInvocations({ toolName: 'Read' });
  console.log('File read operations:', readOps.length);

  // 2. Find all operations for a specific task
  const refactorOps = recorder.queryInvocations({ taskId: 'refactor-utils' });
  console.log('Refactor task operations:', refactorOps.length);

  // 3. Find operations by specific agent and stage
  const developerAnalysis = recorder.queryInvocations({
    agentName: 'developer',
    stageName: 'analysis',
  });
  console.log('Developer analysis operations:', developerAnalysis.length);

  // 4. Find operations with specific parameters
  const utilsFileOps = recorder.queryInvocations({
    parameters: { file_path: '/src/utils.ts' },
  });
  console.log('Operations on utils.ts:', utilsFileOps.length);

  // 5. Limit results
  const recent = recorder.queryInvocations({ limit: 2 });
  console.log('Most recent 2 operations:', recent.length);

  return recorder;
}

/**
 * Example 5: Time-based analysis
 */
async function timeBasedAnalysisExample() {
  const recorder = new ToolInvocationRecorder();

  // Record operations at different times
  const startTime = new Date();

  recorder.recordInvocation({
    toolName: 'Read',
    parameters: { file_path: '/config.json' },
    context: { taskId: 'task-1' },
  });

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));
  const midTime = new Date();

  recorder.recordInvocation({
    toolName: 'Write',
    parameters: { file_path: '/output.json' },
    context: { taskId: 'task-2' },
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  const endTime = new Date();

  recorder.recordInvocation({
    toolName: 'Edit',
    parameters: { file_path: '/app.ts' },
    context: { taskId: 'task-3' },
  });

  // Time-based queries
  const allOps = recorder.getInvocationsInTimeRange(startTime, endTime);
  console.log('Operations in full time range:', allOps.length);

  const middleOps = recorder.getInvocationsInTimeRange(midTime, endTime);
  console.log('Operations in latter half:', middleOps.length);

  const recentOps = recorder.queryInvocations({
    startTime: midTime,
  });
  console.log('Operations since midpoint:', recentOps.length);
}

/**
 * Example 6: Performance monitoring
 */
function performanceMonitoringExample() {
  const recorder = new ToolInvocationRecorder();

  // Simulate tool executions with performance data
  const performanceData = [
    { tool: 'Read', duration: 50 },
    { tool: 'Read', duration: 75 },
    { tool: 'Write', duration: 120 },
    { tool: 'Bash', duration: 2000 },
    { tool: 'Edit', duration: 80 },
  ];

  performanceData.forEach((data, index) => {
    const invocation: ToolInvocation = {
      toolName: data.tool,
      parameters: { test: `operation-${index}` },
      requestId: `req-${index}`,
    };

    const execution: ToolExecution = {
      callId: `call-${index}`,
      toolName: data.tool,
      input: { test: `operation-${index}` },
      startTime: new Date(),
      endTime: new Date(Date.now() + data.duration),
      duration: data.duration,
      status: 'completed',
      result: { success: true },
    };

    recorder.recordInvocation(invocation);
    recorder.recordExecution(`req-${index}`, execution);
  });

  // Performance analysis
  const stats = recorder.getStats();
  console.log('\n=== Performance Analysis ===');
  console.log('Average execution time:', stats.averageDuration, 'ms');
  console.log('Tool usage frequency:', stats.topTools);

  // Find slow operations
  const allOps = recorder.getAllInvocations();
  const slowOps = allOps.filter(op =>
    op.execution && op.execution.duration && op.execution.duration > 100
  );
  console.log('Slow operations (>100ms):', slowOps.length);

  slowOps.forEach(op => {
    console.log(`- ${op.invocation.toolName}: ${op.execution?.duration}ms`);
  });
}

// ============================================================================
// Run Examples
// ============================================================================

if (require.main === module) {
  console.log('=== ToolInvocationRecorder Usage Examples ===\n');

  console.log('1. Basic Usage');
  basicUsageExample();

  console.log('\n2. Testing Pattern');
  testingExample();

  console.log('\n3. Global Recorder');
  globalRecorderExample();

  console.log('\n4. Advanced Querying');
  advancedQueryingExample();

  console.log('\n5. Time-based Analysis');
  timeBasedAnalysisExample().then(() => {
    console.log('\n6. Performance Monitoring');
    performanceMonitoringExample();

    console.log('\n=== Examples Complete ===');
  });
}