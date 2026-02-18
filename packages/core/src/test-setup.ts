/**
 * @fileoverview Test setup for permission assertion helpers
 *
 * This file sets up custom Vitest matchers for permission testing.
 * It should be imported in test setup files or individual test files.
 */

import { expect } from 'vitest';
import { setupPermissionMatchers } from './test-utils.js';

// Automatically register the custom permission matchers
setupPermissionMatchers(expect);

// Export the matcher functions for manual registration if needed
export {
  toBePermissionGranted,
  toBePermissionDenied,
  toBePermissionPending,
  toHavePermissionContext,
  toHavePermissionHistory,
  setupPermissionMatchers,
} from './test-utils.js';