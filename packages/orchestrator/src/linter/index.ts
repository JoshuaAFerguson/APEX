/**
 * Linter Plugin System
 *
 * This module provides the foundation for implementing linter plugins in APEX.
 * It exports the core interfaces, types, and base classes needed to create
 * custom linter integrations.
 *
 * Key components:
 * - LinterService: Orchestration layer for managing multiple linters
 * - ILinterPlugin/BaseLinterPlugin: Plugin interface and base class
 * - ESLintPlugin: Reference ESLint integration
 *
 * @module orchestrator/linter
 */

// Re-export all types and classes from plugin.ts
export * from './plugin';

// Re-export the orchestration service
export * from './service';

// Re-export concrete plugin implementations
export * from './plugins/eslint';
export * from './plugins/prettier';