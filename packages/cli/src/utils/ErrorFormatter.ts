import chalk from 'chalk';

/**
 * Verbosity levels for error display
 */
export enum ErrorVerbosity {
  /** Minimal output: just the error message */
  MINIMAL = 'minimal',
  /** Normal output: error message with basic context */
  NORMAL = 'normal',
  /** Verbose output: full error details with context and suggestions */
  VERBOSE = 'verbose',
}

/**
 * Error context information for providing additional details
 */
export interface ErrorContext {
  /** File path where the error occurred */
  file?: string;
  /** Line number where the error occurred */
  line?: number;
  /** Column number where the error occurred */
  column?: number;
  /** Function or method name where the error occurred */
  function?: string;
  /** Additional context description */
  description?: string;
  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Suggestion for resolving the error
 */
export interface ErrorSuggestion {
  /** Brief description of the suggestion */
  title: string;
  /** Detailed explanation of how to implement the suggestion */
  description: string;
  /** Command or code example to resolve the issue */
  command?: string;
}

/**
 * Error types with different styling and handling
 */
export enum ErrorType {
  /** Critical system errors */
  SYSTEM = 'system',
  /** Validation errors from user input */
  VALIDATION = 'validation',
  /** Configuration or setup errors */
  CONFIG = 'config',
  /** Network or API errors */
  NETWORK = 'network',
  /** File system errors */
  FILESYSTEM = 'filesystem',
  /** Generic application errors */
  APPLICATION = 'application',
}

/**
 * Complete error information for formatting
 */
export interface FormattedError {
  /** Error type for styling */
  type: ErrorType;
  /** Primary error message */
  message: string;
  /** Error context information */
  context?: ErrorContext;
  /** Suggestions for resolving the error */
  suggestions?: ErrorSuggestion[];
  /** Original error object for debugging */
  originalError?: Error;
}

/**
 * Styled error formatter for CLI output using chalk
 */
export class ErrorFormatter {
  private verbosity: ErrorVerbosity;

  constructor(verbosity: ErrorVerbosity = ErrorVerbosity.NORMAL) {
    this.verbosity = verbosity;
  }

  /**
   * Set the verbosity level for error output
   */
  setVerbosity(verbosity: ErrorVerbosity): void {
    this.verbosity = verbosity;
  }

  /**
   * Format an error for display in the CLI
   */
  format(error: FormattedError): string {
    const sections: string[] = [];

    // Error header with icon and type styling
    sections.push(this.formatHeader(error.type, error.message));

    // Context section (file:line, function, etc.)
    if (error.context && this.verbosity !== ErrorVerbosity.MINIMAL) {
      const contextSection = this.formatContext(error.context);
      if (contextSection) {
        sections.push(contextSection);
      }
    }

    // Suggestions section
    if (error.suggestions && error.suggestions.length > 0 && this.verbosity !== ErrorVerbosity.MINIMAL) {
      sections.push(this.formatSuggestions(error.suggestions));
    }

    // Stack trace for verbose mode
    if (error.originalError?.stack && this.verbosity === ErrorVerbosity.VERBOSE) {
      sections.push(this.formatStackTrace(error.originalError.stack));
    }

    return sections.join('\n\n');
  }

  /**
   * Format error header with appropriate styling based on error type
   */
  private formatHeader(type: ErrorType, message: string): string {
    const typeConfig = this.getTypeConfig(type);
    const icon = typeConfig.icon;
    const colorFn = typeConfig.color;

    return `${colorFn(`${icon} ${type.toUpperCase()}`)} ${chalk.white(message)}`;
  }

  /**
   * Format context information section
   */
  private formatContext(context: ErrorContext): string {
    const contextLines: string[] = [];

    // File location
    if (context.file) {
      let location = chalk.cyan(context.file);
      if (context.line !== undefined) {
        location += chalk.gray(':') + chalk.yellow(context.line.toString());
        if (context.column !== undefined) {
          location += chalk.gray(':') + chalk.yellow(context.column.toString());
        }
      }
      contextLines.push(chalk.gray('📍 Location: ') + location);
    }

    // Function context
    if (context.function) {
      contextLines.push(chalk.gray('⚡ Function: ') + chalk.magenta(context.function));
    }

    // Additional description
    if (context.description) {
      contextLines.push(chalk.gray('📝 Context: ') + chalk.white(context.description));
    }

    return contextLines.length > 0 ? contextLines.join('\n') : '';
  }

  /**
   * Format suggestions section
   */
  private formatSuggestions(suggestions: ErrorSuggestion[]): string {
    const suggestionLines: string[] = [
      chalk.green('💡 Suggestions:')
    ];

    suggestions.forEach((suggestion, index) => {
      const number = chalk.green(`${index + 1}.`);
      const title = chalk.white(suggestion.title);
      suggestionLines.push(`   ${number} ${title}`);

      if (suggestion.description) {
        const description = chalk.gray(suggestion.description);
        suggestionLines.push(`      ${description}`);
      }

      if (suggestion.command) {
        const command = chalk.cyan(suggestion.command);
        suggestionLines.push(`      ${chalk.gray('$')} ${command}`);
      }

      // Add spacing between suggestions except for the last one
      if (index < suggestions.length - 1) {
        suggestionLines.push('');
      }
    });

    return suggestionLines.join('\n');
  }

  /**
   * Format stack trace for verbose output
   */
  private formatStackTrace(stack: string): string {
    const lines = [
      chalk.gray('🔍 Stack Trace:'),
      chalk.gray(stack.split('\n').map(line => `   ${line}`).join('\n'))
    ];
    return lines.join('\n');
  }

  /**
   * Get configuration for error type styling
   */
  private getTypeConfig(type: ErrorType): { icon: string; color: (text: string) => string } {
    switch (type) {
      case ErrorType.SYSTEM:
        return { icon: '💥', color: chalk.red };
      case ErrorType.VALIDATION:
        return { icon: '⚠️', color: chalk.yellow };
      case ErrorType.CONFIG:
        return { icon: '⚙️', color: chalk.blue };
      case ErrorType.NETWORK:
        return { icon: '🌐', color: chalk.magenta };
      case ErrorType.FILESYSTEM:
        return { icon: '📁', color: chalk.cyan };
      case ErrorType.APPLICATION:
      default:
        return { icon: '❌', color: chalk.red };
    }
  }

  /**
   * Convenience method to format a simple error message
   */
  formatSimple(message: string, type: ErrorType = ErrorType.APPLICATION): string {
    return this.format({
      type,
      message,
    });
  }

  /**
   * Convenience method to format an error from a JavaScript Error object
   */
  formatFromError(
    error: Error,
    type: ErrorType = ErrorType.APPLICATION,
    context?: ErrorContext,
    suggestions?: ErrorSuggestion[]
  ): string {
    return this.format({
      type,
      message: error.message,
      context,
      suggestions,
      originalError: error,
    });
  }

  /**
   * Format multiple errors as a list
   */
  formatMultiple(errors: FormattedError[]): string {
    if (errors.length === 0) {
      return '';
    }

    if (errors.length === 1) {
      return this.format(errors[0]);
    }

    const sections = [
      chalk.red(`❌ ${errors.length} errors found:`)
    ];

    errors.forEach((error, index) => {
      sections.push(chalk.gray(`\n--- Error ${index + 1} ---`));
      sections.push(this.format(error));
    });

    return sections.join('\n');
  }
}

/**
 * Default error formatter instance for convenience
 */
export const defaultErrorFormatter = new ErrorFormatter();

/**
 * Quick convenience functions for common error formatting
 */
export const formatError = {
  system: (message: string, context?: ErrorContext, suggestions?: ErrorSuggestion[]) =>
    defaultErrorFormatter.format({ type: ErrorType.SYSTEM, message, context, suggestions }),

  validation: (message: string, context?: ErrorContext, suggestions?: ErrorSuggestion[]) =>
    defaultErrorFormatter.format({ type: ErrorType.VALIDATION, message, context, suggestions }),

  config: (message: string, context?: ErrorContext, suggestions?: ErrorSuggestion[]) =>
    defaultErrorFormatter.format({ type: ErrorType.CONFIG, message, context, suggestions }),

  network: (message: string, context?: ErrorContext, suggestions?: ErrorSuggestion[]) =>
    defaultErrorFormatter.format({ type: ErrorType.NETWORK, message, context, suggestions }),

  filesystem: (message: string, context?: ErrorContext, suggestions?: ErrorSuggestion[]) =>
    defaultErrorFormatter.format({ type: ErrorType.FILESYSTEM, message, context, suggestions }),

  application: (message: string, context?: ErrorContext, suggestions?: ErrorSuggestion[]) =>
    defaultErrorFormatter.format({ type: ErrorType.APPLICATION, message, context, suggestions }),
};