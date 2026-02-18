/**
 * Mock Factories for APEX Core Domain Types
 *
 * This module provides type-safe mock factories for all core domain types
 * defined in packages/core/src/types.ts. Each factory supports partial
 * overrides and generates valid typed objects for testing.
 *
 * @example
 * ```typescript
 * import { createTask, createAgent, createWorkflow } from '@apex/core/factories';
 *
 * const task = createTask({ description: 'Custom test task' });
 * const agent = createAgent({ name: 'test-agent' });
 * const workflow = createWorkflow({ name: 'test-workflow' });
 * ```
 */

// Re-export all factories
export * from './task-factory.js';
export * from './agent-factory.js';
export * from './workflow-factory.js';
export * from './permission-factory.js';
export * from './config-factory.js';
export * from './log-factory.js';
export * from './audit-factory.js';