/**
 * Manual verification of EventCapture implementation
 * This file validates that the EventCapture utility compiles and works correctly
 */

import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture, type CapturedEvent } from './event-capture';

// Type checking - this will fail at compile time if types are wrong
const testTypeChecking = () => {
  const emitter = new EventEmitter();
  const capture = new EventCapture(emitter, {
    autoStart: true,
    maxEvents: 100,
    filterTypes: ['test:event']
  });

  // Method existence checks
  const _getAllEvents: CapturedEvent[] = capture.getAllEvents();
  const _getEventsByType: CapturedEvent[] = capture.getEventsByType('test');
  const _getLastEvent: CapturedEvent | undefined = capture.getLastEvent();

  // Confirmation event helpers
  const _approvalEvents = capture.getApprovalRequiredEvents();
  const _gateEvents = capture.getGateEvents();
  const _confirmationEvents = capture.getConfirmationEvents();

  // Assertion methods (should not throw type errors)
  capture.expectEventEmitted('test');
  capture.expectEventNotEmitted('test');
  capture.expectEventSequence(['test1', 'test2']);
  capture.expectEventData('test', { prop: 'value' });
  capture.expectEventCount('test', 1);
  capture.expectTotalEventCount(1);

  // Async methods
  const _waitPromise: Promise<CapturedEvent> = capture.waitForEvent('test');
  const _waitSequencePromise: Promise<CapturedEvent[]> = capture.waitForEventSequence(['test1', 'test2']);

  // Helper functions
  const _helperCapture1 = createEventCapture(emitter);
  const _helperCapture2 = createConfirmationEventCapture(emitter);

  capture.dispose();
};

// Runtime functionality verification
const testRuntimeFunctionality = () => {
  console.log('Testing EventCapture runtime functionality...');

  const emitter = new EventEmitter();
  const capture = createEventCapture(emitter, { maxEvents: 5 });

  let testsPassed = 0;
  const total = 15;

  try {
    // Test 1: Basic event capture
    emitter.emit('test:event', { id: 'test-1' });
    if (capture.getAllEvents().length === 1) {
      testsPassed++;
      console.log('✓ Test 1: Basic event capture');
    } else {
      console.log('✗ Test 1: Basic event capture');
    }

    // Test 2: Event data preservation
    const events = capture.getAllEvents();
    if (events[0].data.id === 'test-1' && events[0].type === 'test:event') {
      testsPassed++;
      console.log('✓ Test 2: Event data preservation');
    } else {
      console.log('✗ Test 2: Event data preservation');
    }

    // Test 3: Multiple events
    emitter.emit('test:event2', { id: 'test-2' });
    if (capture.getAllEvents().length === 2) {
      testsPassed++;
      console.log('✓ Test 3: Multiple events');
    } else {
      console.log('✗ Test 3: Multiple events');
    }

    // Test 4: Event filtering by type
    const filteredEvents = capture.getEventsByType('test:event');
    if (filteredEvents.length === 1 && filteredEvents[0].data.id === 'test-1') {
      testsPassed++;
      console.log('✓ Test 4: Event filtering by type');
    } else {
      console.log('✗ Test 4: Event filtering by type');
    }

    // Test 5: Last event
    const lastEvent = capture.getLastEvent();
    if (lastEvent && lastEvent.type === 'test:event2') {
      testsPassed++;
      console.log('✓ Test 5: Last event');
    } else {
      console.log('✗ Test 5: Last event');
    }

    // Test 6: Event assertions (positive)
    try {
      capture.expectEventEmitted('test:event');
      testsPassed++;
      console.log('✓ Test 6: Event assertions (positive)');
    } catch {
      console.log('✗ Test 6: Event assertions (positive)');
    }

    // Test 7: Event assertions (negative)
    try {
      capture.expectEventNotEmitted('nonexistent:event');
      testsPassed++;
      console.log('✓ Test 7: Event assertions (negative)');
    } catch {
      console.log('✗ Test 7: Event assertions (negative)');
    }

    // Test 8: Event sequence assertion
    try {
      capture.expectEventSequence(['test:event', 'test:event2']);
      testsPassed++;
      console.log('✓ Test 8: Event sequence assertion');
    } catch {
      console.log('✗ Test 8: Event sequence assertion');
    }

    // Test 9: Event data validation
    try {
      capture.expectEventData('test:event', { id: 'test-1' });
      testsPassed++;
      console.log('✓ Test 9: Event data validation');
    } catch {
      console.log('✗ Test 9: Event data validation');
    }

    // Test 10: Event count validation
    try {
      capture.expectEventCount('test:event', 1);
      testsPassed++;
      console.log('✓ Test 10: Event count validation');
    } catch {
      console.log('✗ Test 10: Event count validation');
    }

    // Test 11: Stop/start functionality
    capture.stop();
    emitter.emit('test:ignored', { id: 'ignored' });
    if (capture.getAllEvents().length === 2) { // Should still be 2
      testsPassed++;
      console.log('✓ Test 11: Stop functionality');
    } else {
      console.log('✗ Test 11: Stop functionality');
    }

    // Test 12: Restart functionality
    capture.start();
    emitter.emit('test:after-restart', { id: 'restart' });
    if (capture.getAllEvents().length === 3) {
      testsPassed++;
      console.log('✓ Test 12: Restart functionality');
    } else {
      console.log('✗ Test 12: Restart functionality');
    }

    // Test 13: Clear functionality
    capture.clear();
    if (capture.getAllEvents().length === 0) {
      testsPassed++;
      console.log('✓ Test 13: Clear functionality');
    } else {
      console.log('✗ Test 13: Clear functionality');
    }

    // Test 14: Max events limit
    for (let i = 0; i < 10; i++) {
      emitter.emit('limit:test', { index: i });
    }
    if (capture.getAllEvents().length === 5) { // Should be capped at 5
      testsPassed++;
      console.log('✓ Test 14: Max events limit');
    } else {
      console.log('✗ Test 14: Max events limit');
    }

    // Test 15: Confirmation events helper
    capture.clear();
    emitter.emit('approval:required', { taskId: 'test-task' });
    emitter.emit('permission:request', { requestId: 'test-request' });
    const confirmationEvents = capture.getConfirmationEvents();
    if (confirmationEvents.length === 2) {
      testsPassed++;
      console.log('✓ Test 15: Confirmation events helper');
    } else {
      console.log('✗ Test 15: Confirmation events helper');
    }

    capture.dispose();

    console.log(`\nEventCapture verification completed: ${testsPassed}/${total} tests passed`);
    return testsPassed === total;

  } catch (error) {
    console.error('Runtime testing failed:', error);
    capture.dispose();
    return false;
  }
};

// Test helper functions
const testHelperFunctions = () => {
  console.log('\nTesting helper functions...');

  const emitter = new EventEmitter();

  try {
    // Test createEventCapture
    const capture1 = createEventCapture(emitter);
    emitter.emit('test:event', {});
    if (capture1.getAllEvents().length === 1) {
      console.log('✓ createEventCapture works');
    } else {
      console.log('✗ createEventCapture failed');
    }
    capture1.dispose();

    // Test createConfirmationEventCapture
    const capture2 = createConfirmationEventCapture(emitter);
    emitter.emit('approval:required', {});
    emitter.emit('task:started', {}); // Should be filtered out
    emitter.emit('permission:denied', {});

    const events = capture2.getAllEvents();
    if (events.length === 2 && events.every(e => ['approval:required', 'permission:denied'].includes(e.type))) {
      console.log('✓ createConfirmationEventCapture works');
      return true;
    } else {
      console.log('✗ createConfirmationEventCapture failed');
      return false;
    }

  } catch (error) {
    console.error('Helper function testing failed:', error);
    return false;
  }
};

// Main validation function
export const runValidation = () => {
  console.log('Starting EventCapture implementation validation...\n');

  try {
    // Type checking (will fail at compile time if there are issues)
    testTypeChecking();
    console.log('✓ Type checking passed\n');

    // Runtime functionality
    const runtimePassed = testRuntimeFunctionality();

    // Helper functions
    const helpersPassed = testHelperFunctions();

    const overallSuccess = runtimePassed && helpersPassed;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`EventCapture Validation: ${overallSuccess ? 'PASSED' : 'FAILED'}`);
    console.log(`${'='.repeat(50)}`);

    return overallSuccess;

  } catch (error) {
    console.error('Validation failed with error:', error);
    return false;
  }
};

// Export for external use
export { testTypeChecking, testRuntimeFunctionality, testHelperFunctions };