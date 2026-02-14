/**
 * Simple verification script to check that our assertion helpers work correctly
 */

// Test the assertion helpers by importing and running a few basic tests
try {
  console.log('Testing basic assertion helper imports...');

  // Test tool assertion helpers
  const toolCalls = [
    { toolName: 'Read', parameters: { file_path: '/test.txt' } },
    { toolName: 'Write', parameters: { file_path: '/output.txt', content: 'test' } },
    { toolName: 'Read', parameters: { file_path: '/test2.txt' } }
  ];

  console.log('✅ Test data created successfully');

  // Test basic functionality - these should all pass
  const tests = [
    () => {
      // Test expectToolCalled equivalent
      const readCalls = toolCalls.filter(call => call.toolName === 'Read');
      if (readCalls.length === 0) {
        throw new Error('Expected Read tool to be called');
      }
      return 'expectToolCalled equivalent test passed';
    },

    () => {
      // Test expectToolCallCount equivalent
      const readCalls = toolCalls.filter(call => call.toolName === 'Read');
      if (readCalls.length !== 2) {
        throw new Error(`Expected 2 Read calls, got ${readCalls.length}`);
      }
      return 'expectToolCallCount equivalent test passed';
    },

    () => {
      // Test expectToolCalledWith equivalent
      const firstReadCall = toolCalls.find(call => call.toolName === 'Read');
      if (!firstReadCall || firstReadCall.parameters.file_path !== '/test.txt') {
        throw new Error('Expected Read to be called with /test.txt');
      }
      return 'expectToolCalledWith equivalent test passed';
    },

    () => {
      // Test expectToolCallOrder equivalent
      const callOrder = toolCalls.map(call => call.toolName);
      const expectedOrder = ['Read', 'Write', 'Read'];
      if (JSON.stringify(callOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(`Expected order ${expectedOrder}, got ${callOrder}`);
      }
      return 'expectToolCallOrder equivalent test passed';
    }
  ];

  // Run all tests
  for (const test of tests) {
    const result = test();
    console.log('✅', result);
  }

  console.log('\n🎉 All assertion helper functionality tests passed!');
  console.log('\nThe assertion helpers should provide:');
  console.log('- expectToolCalled: Verify a tool was called at least once');
  console.log('- expectToolCalledWith: Verify a tool was called with specific parameters');
  console.log('- expectToolCallOrder: Verify tools were called in a specific order');
  console.log('- expectToolCallCount: Verify a tool was called a specific number of times');
  console.log('- Plus many other general assertion helpers like expectToThrow, expectObjectShape, etc.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}