/**
 * Base Import Detector
 *
 * Abstract base class for import detection strategies. Provides common
 * functionality for detecting missing imports in source files.
 *
 * @module orchestrator/import-auto-fixer/detectors/base-detector
 */

import type {
  IImportDetector,
  MissingImport,
  ImportContext,
} from '../types';

/**
 * Abstract base class for import detectors
 *
 * Provides common functionality and utilities for implementing
 * import detection strategies.
 *
 * @example
 * ```typescript
 * class MyDetector extends BaseDetector {
 *   readonly id = 'my-detector';
 *   readonly name = 'My Custom Detector';
 *
 *   async detect(filePath: string, content: string): Promise<MissingImport[]> {
 *     // Implementation
 *   }
 *
 *   async isAvailable(): Promise<boolean> {
 *     return true;
 *   }
 * }
 * ```
 */
export abstract class BaseDetector implements IImportDetector {
  /**
   * Unique identifier for the detector
   */
  abstract readonly id: string;

  /**
   * Human-readable name for the detector
   */
  abstract readonly name: string;

  /**
   * Detect missing imports in a file
   * @param filePath - Path to the file
   * @param content - File content
   * @returns Array of missing imports
   */
  abstract detect(filePath: string, content: string): Promise<MissingImport[]>;

  /**
   * Check if the detector is available (dependencies installed)
   */
  abstract isAvailable(): Promise<boolean>;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Determine the file language from extension
   * @param filePath - File path
   * @returns Language identifier
   */
  protected getFileLanguage(filePath: string): 'typescript' | 'javascript' | 'unknown' {
    const ext = this.getFileExtension(filePath).toLowerCase();

    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.mts':
      case '.cts':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      default:
        return 'unknown';
    }
  }

  /**
   * Get file extension from path
   * @param filePath - File path
   * @returns File extension including dot
   */
  protected getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot >= 0 ? filePath.slice(lastDot) : '';
  }

  /**
   * Check if a file is TypeScript
   * @param filePath - File path
   */
  protected isTypeScript(filePath: string): boolean {
    return this.getFileLanguage(filePath) === 'typescript';
  }

  /**
   * Check if a file is JSX/TSX
   * @param filePath - File path
   */
  protected isJSX(filePath: string): boolean {
    const ext = this.getFileExtension(filePath).toLowerCase();
    return ext === '.jsx' || ext === '.tsx';
  }

  /**
   * Create a MissingImport object
   * @param params - Import parameters
   */
  protected createMissingImport(params: {
    identifier: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    context?: ImportContext;
    suggestedSources?: string[];
    isTypeOnly?: boolean;
  }): MissingImport {
    return {
      identifier: params.identifier,
      line: Math.max(1, params.line),
      column: Math.max(1, params.column),
      ...(params.endLine !== undefined && { endLine: params.endLine }),
      ...(params.endColumn !== undefined && { endColumn: params.endColumn }),
      ...(params.context && { context: params.context }),
      ...(params.suggestedSources?.length && { suggestedSources: params.suggestedSources }),
      ...(params.isTypeOnly !== undefined && { isTypeOnly: params.isTypeOnly }),
    };
  }

  /**
   * Filter out built-in globals that don't need imports
   * @param identifier - Identifier to check
   * @returns True if the identifier is a built-in global
   */
  protected isBuiltInGlobal(identifier: string): boolean {
    const builtInGlobals = new Set([
      // JavaScript globals
      'Array',
      'Boolean',
      'Date',
      'Error',
      'Function',
      'JSON',
      'Map',
      'Math',
      'Number',
      'Object',
      'Promise',
      'Proxy',
      'Reflect',
      'RegExp',
      'Set',
      'String',
      'Symbol',
      'WeakMap',
      'WeakSet',
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'fetch',
      'URL',
      'URLSearchParams',
      'Buffer',
      'process',
      'global',
      'globalThis',
      '__dirname',
      '__filename',
      'module',
      'exports',
      'require',
      // TypeScript utility types
      'Partial',
      'Required',
      'Readonly',
      'Record',
      'Pick',
      'Omit',
      'Exclude',
      'Extract',
      'NonNullable',
      'Parameters',
      'ConstructorParameters',
      'ReturnType',
      'InstanceType',
      'ThisParameterType',
      'OmitThisParameter',
      'ThisType',
      'Awaited',
      // Common DOM globals
      'window',
      'document',
      'Element',
      'HTMLElement',
      'Event',
      'EventTarget',
      'Node',
      'NodeList',
      'FormData',
      'Blob',
      'File',
      'FileReader',
      'Response',
      'Request',
      'Headers',
    ]);

    return builtInGlobals.has(identifier);
  }

  /**
   * Deduplicate missing imports by identifier
   * @param imports - Array of missing imports
   * @returns Deduplicated array
   */
  protected deduplicateImports(imports: MissingImport[]): MissingImport[] {
    const seen = new Map<string, MissingImport>();

    for (const imp of imports) {
      // Keep the first occurrence (usually the one with best context)
      if (!seen.has(imp.identifier)) {
        seen.set(imp.identifier, imp);
      }
    }

    return Array.from(seen.values());
  }
}
