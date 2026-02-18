/**
 * @fileoverview Integration Test Utilities - Main Export File
 *
 * This is the primary entry point for all integration test utilities in APEX.
 * It provides a centralized location for importing all test helpers, fixtures,
 * mock factories, and browser automation utilities.
 *
 * Usage:
 * ```typescript
 * import {
 *   createToolMock,
 *   createPermissionFixture,
 *   setupIntegrationTest,
 *   createBrowserTestContext
 * } from '@/tests/integration/test-utilities';
 * ```
 */

// Core test setup and utilities
export * from './setup-helpers.js';
export * from './test-context.js';

// Mock factories
export * from './tool-mocks/index.js';
export * from './permission-mocks/index.js';

// Test fixtures
export * from './fixtures/index.js';

// Browser automation utilities
export * from './browser-automation/index.js';

// Common types and interfaces
export * from './types.js';

// Helper functions
export * from './helpers.js';