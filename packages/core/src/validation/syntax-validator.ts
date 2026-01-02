/**
 * @fileoverview SyntaxValidator interface and abstract base class
 *
 * This module provides the core validation infrastructure for syntax validation
 * within the APEX platform. It defines the contract for implementing language-specific
 * syntax validators and provides an abstract base class with common functionality.
 *
 * ## Architecture Decision Record (ADR-015)
 *
 * ### Context
 * APEX needs a standardized way to validate code syntax across different programming
 * languages. This is essential for:
 * - Ensuring agent-generated code is syntactically valid before committing
 * - Providing early feedback during code generation
 * - Enabling language-specific validation rules and linting
 * - Supporting custom validation for project-specific patterns
 *
 * ### Decision
 * Implement a `SyntaxValidator` interface and `BaseSyntaxValidator` abstract class that:
 * 1. Defines a clear contract via `SyntaxValidatorInterface`
 * 2. Uses a `SyntaxValidationResult` type with errors, warnings, and isValid flag
 * 3. Supports language identification via `SupportedLanguage` type
 * 4. Provides template method pattern for extensibility
 * 5. Integrates with existing validation patterns in the codebase
 *
 * ### Consequences
 * - Consistent syntax validation across all language implementations
 * - Easy to add new language support via concrete implementations
 * - Validation results can be used for error reporting and feedback
 * - Extensible architecture for future validation requirements
 *
 * @module @apex/core/validation/syntax-validator
 */

import { z } from 'zod';

// ============================================================================
// Supported Languages
// ============================================================================

/**
 * Supported programming languages for syntax validation.
 * This list can be extended as new language validators are implemented.
 */
export const SupportedLanguageSchema = z.enum([
  'javascript',
  'typescript',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'scala',
  'shell',
  'bash',
  'powershell',
  'sql',
  'json',
  'yaml',
  'xml',
  'html',
  'css',
  'scss',
  'markdown',
  'dockerfile',
  'toml',
  'ini',
]);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

// ============================================================================
// Validation Error Types
// ============================================================================

/**
 * Severity levels for validation issues
 */
export const ValidationSeveritySchema = z.enum([
  'error',     // Syntax error - code will not parse/compile
  'warning',   // Potential issue - code may have problems
  'info',      // Informational message - style or convention suggestion
  'hint',      // Minor suggestion - optional improvement
]);
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;

/**
 * Source location information for a validation issue
 */
export const SourceLocationSchema = z.object({
  /** Line number (1-based) */
  line: z.number().int().min(1),
  /** Column number (1-based) */
  column: z.number().int().min(1),
  /** End line number (1-based, optional for single-point locations) */
  endLine: z.number().int().min(1).optional(),
  /** End column number (1-based, optional for single-point locations) */
  endColumn: z.number().int().min(1).optional(),
  /** Character offset from start of content (0-based) */
  offset: z.number().int().min(0).optional(),
  /** Length of the problematic span in characters */
  length: z.number().int().min(0).optional(),
});
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

/**
 * A single validation error or warning
 */
export const ValidationIssueSchema = z.object({
  /** Unique code identifying the issue type (e.g., 'E001', 'syntax-error') */
  code: z.string().min(1),
  /** Human-readable description of the issue */
  message: z.string().min(1),
  /** Severity level of the issue */
  severity: ValidationSeveritySchema,
  /** Source location where the issue was found */
  location: SourceLocationSchema.optional(),
  /** The source text that caused the issue (for context) */
  source: z.string().optional(),
  /** Suggested fix or correction */
  suggestion: z.string().optional(),
  /** Rule or validator that detected the issue */
  rule: z.string().optional(),
  /** Additional context or metadata */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

// ============================================================================
// Validation Result
// ============================================================================

/**
 * Result of syntax validation
 */
export const SyntaxValidationResultSchema = z.object({
  /** Whether the content is syntactically valid (no errors) */
  isValid: z.boolean(),
  /** List of errors found during validation */
  errors: z.array(ValidationIssueSchema),
  /** List of warnings found during validation */
  warnings: z.array(ValidationIssueSchema),
  /** Language that was validated */
  language: SupportedLanguageSchema,
  /** Validation duration in milliseconds */
  duration: z.number().min(0).optional(),
  /** Additional metadata about the validation */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SyntaxValidationResult = z.infer<typeof SyntaxValidationResultSchema>;

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for syntax validation
 */
export interface SyntaxValidationOptions {
  /** Maximum number of errors to report (0 = unlimited) */
  maxErrors?: number;
  /** Maximum number of warnings to report (0 = unlimited) */
  maxWarnings?: number;
  /** Whether to include info-level issues */
  includeInfo?: boolean;
  /** Whether to include hint-level issues */
  includeHints?: boolean;
  /** File path for context (used in error reporting) */
  filePath?: string;
  /** Source map for translating locations (for transpiled code) */
  sourceMap?: unknown;
  /** Custom validation rules to apply */
  rules?: Record<string, unknown>;
  /** Abort signal for cancellation support */
  signal?: AbortSignal;
  /** Timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Syntax Validator Interface
// ============================================================================

/**
 * Interface defining the contract for syntax validators.
 *
 * Syntax validators are responsible for checking the syntactic correctness
 * of source code in a specific programming language. They should:
 * - Parse the content and identify syntax errors
 * - Optionally report warnings and style suggestions
 * - Provide source location information for issues
 * - Support validation options for customization
 *
 * @example
 * ```typescript
 * class TypeScriptValidator implements SyntaxValidatorInterface {
 *   getSupportedLanguages(): SupportedLanguage[] {
 *     return ['typescript', 'javascript'];
 *   }
 *
 *   supportsLanguage(language: string): boolean {
 *     return ['typescript', 'javascript'].includes(language);
 *   }
 *
 *   async validateSyntax(
 *     content: string,
 *     language: SupportedLanguage,
 *     options?: SyntaxValidationOptions
 *   ): Promise<SyntaxValidationResult> {
 *     // Parse and validate TypeScript/JavaScript
 *     return {
 *       isValid: true,
 *       errors: [],
 *       warnings: [],
 *       language,
 *     };
 *   }
 * }
 * ```
 */
export interface SyntaxValidatorInterface {
  /**
   * Returns the list of languages this validator can handle.
   *
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): SupportedLanguage[];

  /**
   * Checks if this validator supports a specific language.
   *
   * @param language - Language identifier to check
   * @returns true if the language is supported, false otherwise
   */
  supportsLanguage(language: string): boolean;

  /**
   * Validates the syntax of the provided content.
   *
   * This is the main validation method. It should:
   * - Parse the content according to language grammar
   * - Collect all syntax errors with location information
   * - Optionally collect warnings and suggestions
   * - Return a structured validation result
   *
   * @param content - The source code content to validate
   * @param language - The programming language of the content
   * @param options - Optional validation configuration
   * @returns A promise resolving to the validation result
   */
  validateSyntax(
    content: string,
    language: SupportedLanguage,
    options?: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult>;
}

// ============================================================================
// Base Syntax Validator Abstract Class
// ============================================================================

/**
 * Options for configuring a BaseSyntaxValidator instance.
 */
export interface BaseSyntaxValidatorOptions {
  /** Human-readable name for this validator */
  name: string;
  /** Description of what this validator does */
  description?: string;
  /** Languages this validator supports */
  languages: SupportedLanguage[];
  /** Default validation options */
  defaultOptions?: Partial<SyntaxValidationOptions>;
  /** Version string for the validator */
  version?: string;
}

/**
 * Abstract base class for syntax validators.
 *
 * This class implements the template method pattern, providing a consistent
 * validation lifecycle while allowing subclasses to implement language-specific
 * validation logic.
 *
 * ## Lifecycle
 * 1. `validateSyntax()` - Entry point, validates options and calls implementation
 * 2. `validateImpl()` - Abstract method for actual validation logic
 * 3. Result returned with timing and metadata
 *
 * ## Subclassing
 * Subclasses must implement:
 * - `validateImpl()` - The actual validation logic for supported languages
 *
 * @example
 * ```typescript
 * class JsonSyntaxValidator extends BaseSyntaxValidator {
 *   constructor() {
 *     super({
 *       name: 'JSON Syntax Validator',
 *       description: 'Validates JSON syntax',
 *       languages: ['json'],
 *     });
 *   }
 *
 *   protected async validateImpl(
 *     content: string,
 *     language: SupportedLanguage,
 *     options: SyntaxValidationOptions
 *   ): Promise<SyntaxValidationResult> {
 *     try {
 *       JSON.parse(content);
 *       return this.createSuccessResult(language);
 *     } catch (error) {
 *       return this.createErrorResult(language, [{
 *         code: 'json-parse-error',
 *         message: error.message,
 *         severity: 'error',
 *       }]);
 *     }
 *   }
 * }
 * ```
 */
export abstract class BaseSyntaxValidator implements SyntaxValidatorInterface {
  /** Validator configuration options */
  protected readonly options: BaseSyntaxValidatorOptions;

  /** Set of supported languages for fast lookup */
  private readonly _languageSet: Set<SupportedLanguage>;

  /**
   * Creates a new BaseSyntaxValidator instance.
   *
   * @param options - Configuration options for the validator
   */
  constructor(options: BaseSyntaxValidatorOptions) {
    if (!options.languages || options.languages.length === 0) {
      throw new Error('BaseSyntaxValidator requires at least one supported language');
    }

    this.options = {
      defaultOptions: {
        maxErrors: 100,
        maxWarnings: 100,
        includeInfo: false,
        includeHints: false,
      },
      ...options,
    };

    this._languageSet = new Set(options.languages);
  }

  /**
   * Returns the validator name.
   */
  get name(): string {
    return this.options.name;
  }

  /**
   * Returns the validator description.
   */
  get description(): string | undefined {
    return this.options.description;
  }

  /**
   * Returns the validator version.
   */
  get version(): string | undefined {
    return this.options.version;
  }

  /**
   * Returns the list of languages this validator can handle.
   *
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...this.options.languages];
  }

  /**
   * Checks if this validator supports a specific language.
   *
   * @param language - Language identifier to check
   * @returns true if the language is supported, false otherwise
   */
  supportsLanguage(language: string): boolean {
    return this._languageSet.has(language as SupportedLanguage);
  }

  /**
   * Validates the syntax of the provided content.
   *
   * This method implements the template method pattern:
   * 1. Validates the language is supported
   * 2. Merges options with defaults
   * 3. Records timing information
   * 4. Calls the abstract validateImpl method
   * 5. Applies result limiting and metadata
   *
   * @param content - The source code content to validate
   * @param language - The programming language of the content
   * @param options - Optional validation configuration
   * @returns A promise resolving to the validation result
   * @throws Error if the language is not supported
   */
  async validateSyntax(
    content: string,
    language: SupportedLanguage,
    options?: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult> {
    // Validate language support
    if (!this.supportsLanguage(language)) {
      throw new Error(
        `Language '${language}' is not supported by ${this.name}. ` +
        `Supported languages: ${this.getSupportedLanguages().join(', ')}`
      );
    }

    // Merge options with defaults
    const mergedOptions: SyntaxValidationOptions = {
      ...this.options.defaultOptions,
      ...options,
    };

    // Check for abort signal
    if (mergedOptions.signal?.aborted) {
      return this.createAbortedResult(language);
    }

    // Record start time
    const startTime = performance.now();

    try {
      // Call the implementation
      const result = await this.validateImpl(content, language, mergedOptions);

      // Calculate duration
      const duration = performance.now() - startTime;

      // Apply result limiting
      const limitedResult = this.applyResultLimits(result, mergedOptions);

      // Add metadata
      return {
        ...limitedResult,
        duration,
        metadata: {
          ...limitedResult.metadata,
          validator: this.name,
          validatorVersion: this.version,
        },
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        isValid: false,
        errors: [{
          code: 'validation-error',
          message: `Validation failed: ${errorMessage}`,
          severity: 'error',
        }],
        warnings: [],
        language,
        duration,
        metadata: {
          validator: this.name,
          internalError: true,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        },
      };
    }
  }

  /**
   * Abstract method that subclasses must implement.
   *
   * This is where the actual language-specific validation logic lives.
   * The method receives the content and merged options, and should return
   * a validation result.
   *
   * @param content - The source code content to validate
   * @param language - The programming language of the content
   * @param options - Merged validation options
   * @returns A promise resolving to the validation result
   */
  protected abstract validateImpl(
    content: string,
    language: SupportedLanguage,
    options: SyntaxValidationOptions
  ): Promise<SyntaxValidationResult>;

  /**
   * Creates a success result with no errors or warnings.
   *
   * Helper method for implementations.
   *
   * @param language - The language that was validated
   * @param warnings - Optional array of warnings
   * @returns A successful validation result
   */
  protected createSuccessResult(
    language: SupportedLanguage,
    warnings: ValidationIssue[] = []
  ): SyntaxValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings,
      language,
    };
  }

  /**
   * Creates an error result with the provided errors.
   *
   * Helper method for implementations.
   *
   * @param language - The language that was validated
   * @param errors - Array of error issues
   * @param warnings - Optional array of warnings
   * @returns A failed validation result
   */
  protected createErrorResult(
    language: SupportedLanguage,
    errors: ValidationIssue[],
    warnings: ValidationIssue[] = []
  ): SyntaxValidationResult {
    return {
      isValid: false,
      errors,
      warnings,
      language,
    };
  }

  /**
   * Creates an aborted result.
   *
   * @param language - The language that was being validated
   * @returns An aborted validation result
   */
  private createAbortedResult(language: SupportedLanguage): SyntaxValidationResult {
    return {
      isValid: false,
      errors: [{
        code: 'validation-aborted',
        message: 'Validation was aborted',
        severity: 'error',
      }],
      warnings: [],
      language,
      metadata: {
        aborted: true,
      },
    };
  }

  /**
   * Applies result limits to the validation result.
   *
   * @param result - The validation result to limit
   * @param options - Validation options with limits
   * @returns Limited validation result
   */
  private applyResultLimits(
    result: SyntaxValidationResult,
    options: SyntaxValidationOptions
  ): SyntaxValidationResult {
    let errors = result.errors;
    let warnings = result.warnings;

    // Apply error limit
    if (options.maxErrors && options.maxErrors > 0 && errors.length > options.maxErrors) {
      errors = errors.slice(0, options.maxErrors);
    }

    // Apply warning limit
    if (options.maxWarnings && options.maxWarnings > 0 && warnings.length > options.maxWarnings) {
      warnings = warnings.slice(0, options.maxWarnings);
    }

    // Filter by severity
    if (!options.includeInfo) {
      errors = errors.filter(e => e.severity !== 'info');
      warnings = warnings.filter(w => w.severity !== 'info');
    }

    if (!options.includeHints) {
      errors = errors.filter(e => e.severity !== 'hint');
      warnings = warnings.filter(w => w.severity !== 'hint');
    }

    return {
      ...result,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object implements SyntaxValidatorInterface
 */
export function isSyntaxValidator(obj: unknown): obj is SyntaxValidatorInterface {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getSupportedLanguages' in obj &&
    typeof (obj as SyntaxValidatorInterface).getSupportedLanguages === 'function' &&
    'supportsLanguage' in obj &&
    typeof (obj as SyntaxValidatorInterface).supportsLanguage === 'function' &&
    'validateSyntax' in obj &&
    typeof (obj as SyntaxValidatorInterface).validateSyntax === 'function'
  );
}

/**
 * Type guard to check if an object is a BaseSyntaxValidator instance
 */
export function isBaseSyntaxValidator(obj: unknown): obj is BaseSyntaxValidator {
  return obj instanceof BaseSyntaxValidator;
}

/**
 * Type guard to check if a string is a supported language
 */
export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return SupportedLanguageSchema.safeParse(language).success;
}
