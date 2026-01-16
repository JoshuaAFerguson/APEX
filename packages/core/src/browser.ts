/**
 * Browser-safe exports from @apexcli/core
 *
 * This entry point only exports modules that are compatible with browser environments.
 * It excludes Node.js-specific modules like container-manager, config, tools, etc.
 */

// Types - browser safe (Zod schemas, no Node.js dependencies)
export * from './types.js';

// Exponential Backoff Reconnection - browser safe (uses eventemitter3)
export * from './exponential-backoff.js';

// Connection Health Management - browser safe (uses eventemitter3)
export * from './connection-health.js';

// Health Metrics Collection - browser safe (uses eventemitter3)
export * from './health-metrics.js';

// APEX Error Handling - browser safe (no Node.js dependencies)
export * from './apex-error.js';
