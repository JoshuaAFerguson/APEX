/**
 * SuggestionMatcher - Maps common error patterns to actionable suggestions
 *
 * This module provides:
 * - ErrorPattern: Definition of error patterns with their suggestions
 * - ErrorPatternCategory: Categories of error patterns
 * - SuggestionResult: Result from suggestion lookup
 * - SuggestionMatcher: Main class for matching errors to suggestions
 *
 * @module suggestion-matcher
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Categories of error patterns
 */
export type ErrorPatternCategory =
  | 'typescript'   // TypeScript compiler errors
  | 'filesystem'   // File system errors (ENOENT, EACCES, etc.)
  | 'module'       // Module resolution errors
  | 'permission';  // Permission-related errors

/**
 * Definition of an error pattern with its associated suggestion
 */
export interface ErrorPattern {
  /** Pattern to match against error message (string or regex) */
  pattern: string | RegExp;
  /** Category of this error pattern */
  category: ErrorPatternCategory;
  /** Suggestion to return when pattern matches */
  suggestion: string;
  /** Optional: TypeScript error code (e.g., 'TS2339') */
  code?: string;
}

/**
 * Result from suggestion lookup
 */
export interface SuggestionResult {
  /** The matched pattern category */
  category: ErrorPatternCategory;
  /** The suggestion text */
  suggestion: string;
  /** The matched error code, if applicable */
  code?: string;
  /** Confidence level of the match (exact code match vs regex match) */
  confidence: 'high' | 'medium';
}

// ============================================================================
// SuggestionMatcher Class
// ============================================================================

/**
 * SuggestionMatcher - Maps common error patterns to actionable suggestions
 *
 * Provides a simple interface to look up suggestions for common errors
 * encountered during development workflows. Supports TypeScript errors,
 * file system errors, module resolution errors, and permission errors.
 *
 * @example
 * ```typescript
 * const matcher = new SuggestionMatcher();
 *
 * const suggestion = matcher.getSuggestion("Cannot find module 'foo'");
 * // Returns: { category: 'module', suggestion: '...', confidence: 'medium' }
 *
 * const tsSuggestion = matcher.getSuggestion("TS2339: Property 'x' does not exist");
 * // Returns: { category: 'typescript', suggestion: '...', code: 'TS2339', confidence: 'high' }
 * ```
 */
export class SuggestionMatcher {
  private readonly patterns: ErrorPattern[];

  constructor() {
    this.patterns = [
      ...this.initializeTypeScriptPatterns(),
      ...this.initializeFileSystemPatterns(),
      ...this.initializeModulePatterns(),
      ...this.initializePermissionPatterns(),
    ];
  }

  /**
   * Get a suggestion for an error message
   *
   * @param error - The error message or error object to match
   * @returns SuggestionResult if a matching pattern is found, undefined otherwise
   */
  public getSuggestion(error: string | Error): SuggestionResult | undefined {
    const errorMessage = typeof error === 'string' ? error : error.message;

    // First, try to match by TypeScript error code (highest confidence)
    const tsCodeMatch = errorMessage.match(/TS(\d{4,5})/);
    if (tsCodeMatch) {
      const code = `TS${tsCodeMatch[1]}`;
      const pattern = this.patterns.find(p => p.code === code);
      if (pattern) {
        return {
          category: pattern.category,
          suggestion: pattern.suggestion,
          code: pattern.code,
          confidence: 'high',
        };
      }
    }

    // Fall back to pattern matching
    for (const pattern of this.patterns) {
      const matches = typeof pattern.pattern === 'string'
        ? errorMessage.toLowerCase().includes(pattern.pattern.toLowerCase())
        : pattern.pattern.test(errorMessage);

      if (matches) {
        return {
          category: pattern.category,
          suggestion: pattern.suggestion,
          code: pattern.code,
          confidence: 'medium',
        };
      }
    }

    return undefined;
  }

  /**
   * Get all registered patterns
   */
  public getPatterns(): ReadonlyArray<ErrorPattern> {
    return this.patterns;
  }

  /**
   * Get patterns by category
   */
  public getPatternsByCategory(category: ErrorPatternCategory): ReadonlyArray<ErrorPattern> {
    return this.patterns.filter(p => p.category === category);
  }

  // ============================================================================
  // Private Pattern Initialization Methods
  // ============================================================================

  /**
   * Initialize TypeScript error patterns
   */
  private initializeTypeScriptPatterns(): ErrorPattern[] {
    return [
      {
        pattern: /Cannot find name/i,
        category: 'typescript',
        suggestion: 'Check if the type/variable is imported, or add a type declaration',
        code: 'TS2304'
      },
      {
        pattern: /Property .+ does not exist/i,
        category: 'typescript',
        suggestion: 'Verify the property exists on the type, or use optional chaining (?.) if the property might not exist',
        code: 'TS2339'
      },
      {
        pattern: /Argument of type .+ is not assignable to parameter of type/i,
        category: 'typescript',
        suggestion: 'Check function signature and ensure argument types match the expected parameter types',
        code: 'TS2345'
      },
      {
        pattern: /Type .+ is not assignable to type/i,
        category: 'typescript',
        suggestion: 'Verify type compatibility, use type assertion (as Type) if intentional, or adjust the type definition',
        code: 'TS2322'
      },
      {
        pattern: /Cannot find module/i,
        category: 'typescript',
        suggestion: 'Install the missing package with npm/yarn or add @types/package for type definitions',
        code: 'TS2307'
      },
      {
        pattern: /Object is possibly .*(undefined|null)/i,
        category: 'typescript',
        suggestion: 'Add null/undefined check or use optional chaining (?.) before accessing properties',
        code: 'TS2532'
      },
      {
        pattern: /Object is possibly null/i,
        category: 'typescript',
        suggestion: 'Add null check before accessing properties or use non-null assertion (!) if you are certain',
        code: 'TS2531'
      },
      {
        pattern: /Parameter .+ implicitly has an .any. type/i,
        category: 'typescript',
        suggestion: 'Add explicit type annotation to the parameter to improve type safety',
        code: 'TS7006'
      },
      {
        pattern: /Expected .+(;|,|\}|\)|>) /i,
        category: 'typescript',
        suggestion: 'Check for syntax errors like missing semicolons, commas, or brackets',
        code: 'TS1005'
      },
      {
        pattern: /This expression is not callable/i,
        category: 'typescript',
        suggestion: 'Ensure the value is a function before calling, or check if you meant to access a property instead',
        code: 'TS2349'
      },
      {
        pattern: /Expected \d+ arguments, but got \d+/i,
        category: 'typescript',
        suggestion: 'Check function signature for required/optional parameters and provide the correct number of arguments',
        code: 'TS2554'
      },
      {
        pattern: /Property .+ is missing in type/i,
        category: 'typescript',
        suggestion: 'Add the required property to the object literal or make it optional in the type definition',
        code: 'TS2741'
      }
    ];
  }

  /**
   * Initialize file system error patterns
   */
  private initializeFileSystemPatterns(): ErrorPattern[] {
    return [
      {
        pattern: /ENOENT/i,
        category: 'filesystem',
        suggestion: 'File or directory not found. Verify the path exists and is spelled correctly'
      },
      {
        pattern: /EACCES/i,
        category: 'filesystem',
        suggestion: 'Permission denied. Check file permissions or run with appropriate privileges (e.g., sudo on Unix systems)'
      },
      {
        pattern: /EEXIST/i,
        category: 'filesystem',
        suggestion: 'File or directory already exists. Use a different name or remove the existing file first'
      },
      {
        pattern: /EISDIR/i,
        category: 'filesystem',
        suggestion: 'Expected a file but found a directory. Check your path points to a file, not a directory'
      },
      {
        pattern: /ENOTDIR/i,
        category: 'filesystem',
        suggestion: 'Expected a directory but found a file. Check your path points to a directory, not a file'
      },
      {
        pattern: /ENOTEMPTY/i,
        category: 'filesystem',
        suggestion: 'Directory not empty. Remove contents first or use recursive delete option'
      },
      {
        pattern: /EMFILE/i,
        category: 'filesystem',
        suggestion: 'Too many open files. Close unused file handles or increase system ulimit'
      },
      {
        pattern: /ENOSPC/i,
        category: 'filesystem',
        suggestion: 'No space left on device. Free up disk space by removing unnecessary files'
      }
    ];
  }

  /**
   * Initialize module resolution error patterns
   */
  private initializeModulePatterns(): ErrorPattern[] {
    return [
      {
        pattern: /Cannot find module/i,
        category: 'module',
        suggestion: 'Install the missing package with npm/yarn, or check that the import path is correct'
      },
      {
        pattern: /Module not found/i,
        category: 'module',
        suggestion: 'Verify the module path is correct and the package is installed in node_modules'
      },
      {
        pattern: /Cannot resolve/i,
        category: 'module',
        suggestion: 'Check the import path and ensure the file/module exists at the specified location'
      },
      {
        pattern: /Unexpected token/i,
        category: 'module',
        suggestion: 'The file may have syntax errors or be in an unexpected format. Check file content and syntax'
      },
      {
        pattern: /exports is not defined/i,
        category: 'module',
        suggestion: 'Use ES module syntax (import/export) or configure module type correctly in package.json'
      },
      {
        pattern: /require is not defined/i,
        category: 'module',
        suggestion: 'Use import syntax in ES modules, or add "type": "commonjs" to package.json for CommonJS'
      }
    ];
  }

  /**
   * Initialize permission-related error patterns
   */
  private initializePermissionPatterns(): ErrorPattern[] {
    return [
      {
        pattern: /Permission denied/i,
        category: 'permission',
        suggestion: 'Check file/directory permissions and ownership. You may need elevated privileges'
      },
      {
        pattern: /EPERM/i,
        category: 'permission',
        suggestion: 'Operation not permitted. May require elevated privileges (sudo on Unix, Run as Administrator on Windows)'
      },
      {
        pattern: /Access is denied/i,
        category: 'permission',
        suggestion: 'Windows permission error. Check file permissions and run as administrator if needed'
      },
      {
        pattern: /unauthorized/i,
        category: 'permission',
        suggestion: 'Authentication required. Check credentials, API keys, or login status'
      },
      {
        pattern: /forbidden/i,
        category: 'permission',
        suggestion: 'Access forbidden. Verify you have the required permissions for this resource'
      }
    ];
  }
}