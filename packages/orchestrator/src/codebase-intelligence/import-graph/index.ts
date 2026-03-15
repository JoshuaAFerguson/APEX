/**
 * Import Graph Module
 *
 * Provides import/require statement analysis and dependency graph building.
 *
 * Features:
 * - ES6 import analysis (named, default, namespace, side-effect, dynamic)
 * - CommonJS require statement analysis
 * - TypeScript path alias resolution
 * - Re-export tracking
 * - Circular dependency detection
 * - Impact analysis
 *
 * @example
 * ```typescript
 * import { ImportGraphBuilder } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * const builder = ImportGraphBuilder.getInstance();
 * const graph = await builder.buildGraph('/path/to/project', {
 *   includePatterns: ['src/**\/*.ts'],
 *   tsConfigPath: '/path/to/tsconfig.json'
 * });
 *
 * // Analyze dependencies
 * const circular = builder.findCircularDependencies(graph);
 * const impact = builder.getImpactedFiles(graph, 'src/utils.ts');
 * ```
 *
 * @module orchestrator/codebase-intelligence/import-graph
 */

// Types
export * from './types.js';

// Main builder class (to be implemented)
export { ImportGraphBuilder, getImportGraphBuilder } from './import-graph-builder.js';
