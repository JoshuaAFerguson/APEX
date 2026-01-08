/**
 * Base Import Resolver
 *
 * Abstract base class for import resolution strategies. Provides common
 * functionality for resolving where to import missing symbols from.
 *
 * @module orchestrator/import-auto-fixer/resolvers/base-resolver
 */

import type {
  IImportResolver,
  ImportResolution,
  ResolverContext,
  ImportType,
} from '../types';

/**
 * Abstract base class for import resolvers
 *
 * Provides common functionality and utilities for implementing
 * import resolution strategies.
 *
 * @example
 * ```typescript
 * class MyResolver extends BaseResolver {
 *   readonly id = 'my-resolver';
 *   readonly priority = 50;
 *
 *   async canResolve(identifier: string, context: ResolverContext): Promise<boolean> {
 *     // Implementation
 *   }
 *
 *   async resolve(identifier: string, context: ResolverContext): Promise<ImportResolution | null> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class BaseResolver implements IImportResolver {
  /**
   * Unique identifier for the resolver
   */
  abstract readonly id: string;

  /**
   * Priority order (lower = higher priority)
   */
  abstract readonly priority: number;

  /**
   * Check if this resolver can potentially resolve the identifier
   */
  abstract canResolve(identifier: string, context: ResolverContext): Promise<boolean>;

  /**
   * Attempt to resolve the import source for an identifier
   */
  abstract resolve(identifier: string, context: ResolverContext): Promise<ImportResolution | null>;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Create a resolution result
   */
  protected createResolution(params: {
    source: string;
    importType: ImportType;
    isTypeOnly?: boolean;
    confidence: number;
    aliasAs?: string;
  }): ImportResolution {
    return {
      source: params.source,
      importType: params.importType,
      isTypeOnly: params.isTypeOnly ?? false,
      confidence: Math.max(0, Math.min(1, params.confidence)),
      resolvedBy: this.id,
      ...(params.aliasAs && { aliasAs: params.aliasAs }),
    };
  }

  /**
   * Check if identifier looks like a React component (PascalCase)
   */
  protected looksLikeReactComponent(identifier: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(identifier);
  }

  /**
   * Check if identifier looks like a type (common patterns)
   */
  protected looksLikeType(identifier: string): boolean {
    // Common type suffix patterns
    const typeSuffixes = ['Props', 'State', 'Type', 'Interface', 'Config', 'Options', 'Data'];
    return typeSuffixes.some(suffix => identifier.endsWith(suffix));
  }

  /**
   * Check if identifier looks like a constant (SCREAMING_SNAKE_CASE)
   */
  protected looksLikeConstant(identifier: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(identifier);
  }

  /**
   * Check if identifier is a common hook name
   */
  protected isCommonHook(identifier: string): boolean {
    return identifier.startsWith('use') && identifier.length > 3;
  }

  /**
   * Normalize import path (remove file extensions, add ./ for relative)
   */
  protected normalizeImportPath(
    source: string,
    isRelative: boolean = false
  ): string {
    // Remove .ts, .tsx, .js, .jsx extensions
    let normalized = source.replace(/\.(ts|tsx|js|jsx)$/, '');

    // Remove /index suffix
    normalized = normalized.replace(/\/index$/, '');

    // Add ./ prefix for relative imports if not present
    if (isRelative && !normalized.startsWith('.')) {
      normalized = `./${normalized}`;
    }

    return normalized;
  }

  /**
   * Calculate relative path between two files
   */
  protected getRelativePath(from: string, to: string): string {
    const path = require('path');
    const fromDir = path.dirname(from);
    let relativePath = path.relative(fromDir, to);

    // Ensure forward slashes for consistency
    relativePath = relativePath.replace(/\\/g, '/');

    // Add ./ prefix if needed
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }

    return this.normalizeImportPath(relativePath, true);
  }

  /**
   * Check if a source already exists in imports
   */
  protected isAlreadyImported(
    identifier: string,
    context: ResolverContext
  ): boolean {
    return context.existingImports.some(imp => {
      if (imp.namedImports?.includes(identifier)) return true;
      if (imp.defaultImport === identifier) return true;
      if (imp.namespaceImport === identifier) return true;
      return false;
    });
  }

  /**
   * Get existing import for a source
   */
  protected getExistingImportForSource(
    source: string,
    context: ResolverContext
  ): typeof context.existingImports[0] | undefined {
    return context.existingImports.find(imp => imp.source === source);
  }
}
