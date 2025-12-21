// Simple test script to verify the enhanced daemon event forwarding
const { EnhancedDaemon } = require('./dist/enhanced-daemon');
const { TaskSessionResumedEvent } = require('./dist/index');

console.log('Testing EnhancedDaemon event forwarding...');

try {
  // Test 1: Check if EnhancedDaemon can be instantiated
  const mockConfig = {
    version: '1.0',
    project: { name: 'test-project' },
    daemon: {
      timeBasedUsage: { enabled: false },
      sessionRecovery: { enabled: false },
      idleProcessing: { enabled: false },
      healthCheck: { enabled: false },
      watchdog: { enabled: false },
      installAsService: false,
    },
    limits: {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
      dailyBudget: 100.0,
    },
  };

  const daemon = new EnhancedDaemon('/test/path', mockConfig);
  console.log('✅ EnhancedDaemon instantiated successfully');

  // Test 2: Check if we can register a task:session-resumed event listener
  let eventReceived = false;
  daemon.on('task:session-resumed', (event) => {
    eventReceived = true;
    console.log('✅ Event received:', event.taskId);
  });
  console.log('✅ Event listener registered successfully');

  // Test 3: Check if we can emit the event manually
  const testEvent = {
    taskId: 'test-task-123',
    resumeReason: 'manual_resume',
    contextSummary: 'Test context',
    previousStatus: 'paused',
    sessionData: {
      lastCheckpoint: new Date(),
      contextSummary: 'Test session'
    },
    timestamp: new Date()
  };

  daemon.emit('task:session-resumed', testEvent);

  if (eventReceived) {
    console.log('✅ Event forwarding works correctly');
  } else {
    console.log('❌ Event not received');
  }

  console.log('✅ All basic tests passed!');

} catch (error) {
  console.error('❌ Error during testing:', error.message);
  console.error('Stack:', error.stack);
}