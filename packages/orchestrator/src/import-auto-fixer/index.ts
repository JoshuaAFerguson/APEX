/**
 * Import Auto-Fixer Module
 *
 * This module provides automatic detection and fixing of missing imports
 * in TypeScript and JavaScript files. It uses ESLint rules or TypeScript
 * compiler API for detection and intelligent resolution for finding
 * the correct import sources.
 *
 * Key features:
 * - Detects missing imports using ESLint or TypeScript
 * - Resolves imports from local files, path aliases, and npm packages
 * - Respects project configuration and existing import styles
 * - Provides comprehensive event emission for progress tracking
 *
 * @module orchestrator/import-auto-fixer
 *
 * @example
 * ```typescript
 * import { ImportAutoFixer } from '@apex/orchestrator/import-auto-fixer';
 *
 * const fixer = new ImportAutoFixer({
 *   projectPath: '/path/to/project',
 *   detector: 'auto',
 * });
 *
 * // Analyze files for missing imports
 * const analysis = await fixer.analyze(['src/index.ts']);
 * console.log(`Found ${analysis[0].missingImports.length} missing imports`);
 *
 * // Fix missing imports
 * const results = await fixer.fix(['src/index.ts']);
 * console.log(`Added ${results[0].importsAdded.length} imports`);
 * ```
 */

// Re-export all types
export * from './types';

// Re-export the main service class
export { ImportAutoFixer } from './import-auto-fixer';

// Re-export detectors
export { BaseDetector } from './detectors/base-detector';
export { ESLintDetector } from './detectors/eslint-detector';

// Re-export resolvers
export { BaseResolver } from './resolvers/base-resolver';
export { LocalResolver } from './resolvers/local-resolver';
export { AliasResolver } from './resolvers/alias-resolver';
export { PackageResolver } from './resolvers/package-resolver';
