/**
 * Test utilities for APEX testing
 *
 * This module provides shared testing utilities used across the APEX codebase,
 * including browser test utilities for mock page objects, DOM structures,
 * test URLs, and browser state assertions.
 */

// Existing utilities
export * from './sensitive-patterns';

// Browser test utilities
export * from './mock-page';
export * from './mock-dom';
export * from './test-urls';
export * from './browser-assertions';