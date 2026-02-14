/**
 * Simple validation test to ensure all imports work correctly
 */

// Test imports from event-capture
import { EventCapture, createEventCapture, createConfirmationEventCapture } from './event-capture';

// Test imports from streaming-test-utils
import {
  StreamingEventCapture,
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamingEvent,
  type StreamMetrics
} from './streaming-test-utils';

// Test imports from index
import * as TestUtils from './index';

// Simple validation function
export function validateImports(): boolean {
  try {
    // Check that classes exist and are constructors
    if (typeof EventCapture !== 'function') return false;
    if (typeof StreamingEventCapture !== 'function') return false;

    // Check factory functions exist
    if (typeof createEventCapture !== 'function') return false;
    if (typeof createConfirmationEventCapture !== 'function') return false;
    if (typeof createStreamingEventCapture !== 'function') return false;

    // Check utility classes exist
    if (typeof StreamingTestUtils !== 'object') return false;
    if (typeof StreamingAssertions !== 'object') return false;

    // Check that index exports work
    if (typeof TestUtils.EventCapture !== 'function') return false;
    if (typeof TestUtils.StreamingEventCapture !== 'function') return false;

    return true;
  } catch (error) {
    console.error('Import validation failed:', error);
    return false;
  }
}

export default validateImports;