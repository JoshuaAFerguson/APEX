/**
 * Example usage of EventCapture for validation
 * This demonstrates the key functionality without requiring test infrastructure
 */

import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture } from '../tests/utils/event-capture';

// Simple validation example
function validateEventCapture() {
  console.log('Validating EventCapture implementation...');

  const emitter = new EventEmitter();
  const capture = createEventCapture(emitter);

  try {
    // Test basic event capture
    emitter.emit('test:event', { id: 'test-1' });
    emitter.emit('approval:required', { taskId: 'task-1', gateName: 'gate-1' });

    const allEvents = capture.getAllEvents();
    console.log(`✓ Captured ${allEvents.length} events`);

    // Test event filtering
    const approvalEvents = capture.getApprovalRequiredEvents();
    console.log(`✓ Found ${approvalEvents.length} approval events`);

    // Test assertions
    capture.expectEventEmitted('test:event');
    capture.expectEventEmitted('approval:required');
    console.log('✓ Event assertions passed');

    // Test event data validation
    capture.expectEventData('approval:required', { taskId: 'task-1' });
    console.log('✓ Event data validation passed');

    // Test event sequence
    capture.expectEventSequence(['test:event', 'approval:required']);
    console.log('✓ Event sequence validation passed');

    // Test confirmation events helper
    const confirmationEvents = capture.getConfirmationEvents();
    console.log(`✓ Found ${confirmationEvents.length} confirmation events`);

    capture.dispose();
    console.log('✓ EventCapture validation completed successfully');

    return true;
  } catch (error) {
    console.error('✗ EventCapture validation failed:', error);
    capture.dispose();
    return false;
  }
}

// Export validation function for potential use in tests
export { validateEventCapture };

// Run validation if this file is executed directly
if (require.main === module) {
  const success = validateEventCapture();
  process.exit(success ? 0 : 1);
}