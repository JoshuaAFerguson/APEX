/**
 * Test utilities for APEX testing
 *
 * This module provides shared testing utilities used across the APEX codebase,
 * including:
 * - Browser test utilities for mock page objects, DOM structures, and assertions
 * - Mock tool types for Claude Agent SDK testing
 * - Sensitive pattern detection for testing secret scanning
 */

// Existing utilities
export * from './sensitive-patterns';

// Browser test utilities
export * from './mock-page';
export * from './mock-dom';
export * from './test-urls';
export * from './browser-assertions';

// Mock tool types for Claude Agent SDK testing
export * from './mock-tool-types';

// Claude SDK mock utilities
export * from './claude-sdk-mock';

// Mock tools executor
export * from './mock-tools-executor';

// Mock server utilities
export * from './mock-server';

// Autonomy test fixtures and mock factories
export * from './autonomy-fixtures';

// Test context for unique test isolation
export * from '../test-fixtures/context/index.js';