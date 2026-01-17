/**
 * Simple validation script for EventCapture implementation
 * Tests basic functionality without requiring external dependencies
 */

const { EventEmitter } = require('eventemitter3');

// Import the event capture utilities
let EventCapture, createEventCapture;

try {
  const eventCaptureModule = require('./event-capture');
  EventCapture = eventCaptureModule.EventCapture;
  createEventCapture = eventCaptureModule.createEventCapture;

  console.log('✅ EventCapture module loaded successfully');
} catch (error) {
  console.log('❌ Failed to load EventCapture module:', error.message);
  process.exit(1);
}

function runValidation() {
  console.log('🔍 Validating EventCapture implementation...\n');

  const emitter = new EventEmitter();
  let testsPassed = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      const result = fn();
      if (result) {
        testsPassed++;
        console.log(`✅ ${name}`);
      } else {
        console.log(`❌ ${name}`);
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  try {
    // Test 1: Basic instantiation
    test('Basic instantiation', () => {
      const capture = new EventCapture(emitter);
      capture.dispose();
      return true;
    });

    // Test 2: Event capture
    test('Basic event capture', () => {
      const capture = createEventCapture(emitter);
      emitter.emit('test:event', { id: 'test-1' });
      const events = capture.getAllEvents();
      capture.dispose();
      return events.length === 1 && events[0].data.id === 'test-1';
    });

    // Test 3: Event filtering
    test('Event filtering', () => {
      const capture = new EventCapture(emitter, {
        autoStart: true,
        filterTypes: ['filtered:event']
      });
      emitter.emit('filtered:event', { data: 'captured' });
      emitter.emit('ignored:event', { data: 'ignored' });
      const events = capture.getAllEvents();
      capture.dispose();
      return events.length === 1 && events[0].type === 'filtered:event';
    });

    // Test 4: Event assertions
    test('Event assertions', () => {
      const capture = createEventCapture(emitter);
      emitter.emit('assertion:test', { value: 'test' });
      capture.expectEventEmitted('assertion:test');
      capture.expectEventData('assertion:test', { value: 'test' });
      capture.dispose();
      return true;
    });

    // Test 5: Start/stop functionality
    test('Start/stop functionality', () => {
      const capture = new EventCapture(emitter);
      capture.start();
      emitter.emit('before:stop', {});
      capture.stop();
      emitter.emit('during:stop', {});
      capture.start();
      emitter.emit('after:restart', {});
      const events = capture.getAllEvents();
      capture.dispose();
      return events.length === 2 &&
             events[0].type === 'before:stop' &&
             events[1].type === 'after:restart';
    });

    // Test 6: Max events limit
    test('Max events limit', () => {
      const capture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: 3
      });
      for (let i = 0; i < 5; i++) {
        emitter.emit('limit:test', { index: i });
      }
      const events = capture.getAllEvents();
      capture.dispose();
      return events.length === 3 &&
             events[0].data.index === 2 &&
             events[2].data.index === 4;
    });

    // Test 7: Confirmation event helpers
    test('Confirmation event helpers', () => {
      const capture = createEventCapture(emitter);
      emitter.emit('approval:required', { taskId: 'test' });
      emitter.emit('permission:request', { requestId: 'req' });
      const confirmationEvents = capture.getConfirmationEvents();
      const approvalEvents = capture.getApprovalRequiredEvents();
      capture.dispose();
      return confirmationEvents.length >= 2 && approvalEvents.length === 1;
    });

    // Test 8: Event summary
    test('Event summary', () => {
      const capture = createEventCapture(emitter);
      emitter.emit('summary:test', {});
      emitter.emit('summary:test', {});
      emitter.emit('other:event', {});
      const summary = capture.getEventSummary();
      capture.dispose();
      return summary.includes('summary:test: 2') && summary.includes('other:event: 1');
    });

    console.log(`\n📊 Validation Results: ${testsPassed}/${totalTests} tests passed`);

    if (testsPassed === totalTests) {
      console.log('🎉 All tests passed! EventCapture implementation is working correctly.');
      return true;
    } else {
      console.log('⚠️ Some tests failed. Implementation may have issues.');
      return false;
    }

  } catch (error) {
    console.log(`❌ Validation failed with error: ${error.message}`);
    return false;
  }
}

// Run the validation
const success = runValidation();
process.exit(success ? 0 : 1);