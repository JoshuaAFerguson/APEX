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

  /**
   * Parse TypeScript compiler errors from tsc output
   * Supports both single-line and multi-line formats:
   * - src/file.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
   * - src/file.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.
   */
  parseTypeScriptErrors(tscOutput: string): FormattedError[] {
    const errors: FormattedError[] = [];

    // Regex patterns for TypeScript compiler errors
    // Pattern 1: file.ts(line,col): error TSxxxx: message
    const singleLinePattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/gm;

    // Pattern 2: file.ts:line:col - error TSxxxx: message
    const colonFormatPattern = /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/gm;

    // Extract errors using single-line pattern
    let match;
    while ((match = singleLinePattern.exec(tscOutput)) !== null) {
      const [, filePath, line, column, errorCode, message] = match;

      errors.push({
        type: ErrorType.CONFIG, // TypeScript errors are typically configuration/compilation issues
        message: `${errorCode}: ${message.trim()}`,
        context: {
          file: filePath.trim(),
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          description: `TypeScript compilation error`
        },
        suggestions: this.generateTypeScriptSuggestions(errorCode, message.trim())
      });
    }

    // Extract errors using colon format pattern
    while ((match = colonFormatPattern.exec(tscOutput)) !== null) {
      const [, filePath, line, column, errorCode, message] = match;

      // Avoid duplicates if both patterns match the same error
      const isDuplicate = errors.some(error =>
        error.context?.file === filePath.trim() &&
        error.context?.line === parseInt(line, 10) &&
        error.context?.column === parseInt(column, 10)
      );

      if (!isDuplicate) {
        errors.push({
          type: ErrorType.CONFIG,
          message: `${errorCode}: ${message.trim()}`,
          context: {
            file: filePath.trim(),
            line: parseInt(line, 10),
            column: parseInt(column, 10),
            description: `TypeScript compilation error`
          },
          suggestions: this.generateTypeScriptSuggestions(errorCode, message.trim())
        });
      }
    }

    return errors;
  }

  /**
   * Generate helpful suggestions for common TypeScript errors
   */
  private generateTypeScriptSuggestions(errorCode: string, message: string): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    switch (errorCode) {
      case 'TS2339': // Property does not exist on type
        if (message.includes('does not exist on type')) {
          const propertyMatch = message.match(/Property '([^']+)'/);
          const typeMatch = message.match(/on type '([^']+)'/);

          if (propertyMatch && typeMatch) {
            const property = propertyMatch[1];
            const type = typeMatch[1];

            suggestions.push({
              title: 'Add missing property to type definition',
              description: `Add the "${property}" property to the ${type} interface or type`,
              command: `// Add to ${type} definition:\n${property}: any; // or appropriate type`
            });

            suggestions.push({
              title: 'Use optional chaining',
              description: 'Access the property safely using optional chaining operator',
              command: `obj.${property}?.value`
            });

            suggestions.push({
              title: 'Check property name spelling',
              description: 'Verify the property name is spelled correctly and exists'
            });
          }
        }
        break;

      case 'TS2304': // Cannot find name
        const nameMatch = message.match(/Cannot find name '([^']+)'/);
        if (nameMatch) {
          const name = nameMatch[1];
          suggestions.push({
            title: 'Import missing module or type',
            description: `Import the "${name}" from the appropriate module`,
            command: `import { ${name} } from 'module-name';`
          });

          suggestions.push({
            title: 'Install type definitions',
            description: 'Install TypeScript definitions for the library',
            command: `npm install --save-dev @types/${name.toLowerCase()}`
          });
        }
        break;

      case 'TS2322': // Type is not assignable to type
        suggestions.push({
          title: 'Check type compatibility',
          description: 'Ensure the assigned value matches the expected type'
        });

        suggestions.push({
          title: 'Add type assertion',
          description: 'Use type assertion if you know the type is correct',
          command: 'value as ExpectedType'
        });
        break;

      case 'TS2345': // Argument of type is not assignable to parameter of type
        suggestions.push({
          title: 'Check function parameters',
          description: 'Verify the argument types match the function signature'
        });

        suggestions.push({
          title: 'Convert argument type',
          description: 'Convert the argument to the expected type'
        });
        break;

      case 'TS2307': // Cannot find module
        const moduleMatch = message.match(/Cannot find module '([^']+)'/);
        if (moduleMatch) {
          const moduleName = moduleMatch[1];
          suggestions.push({
            title: 'Install missing package',
            description: `Install the "${moduleName}" package`,
            command: `npm install ${moduleName}`
          });

          suggestions.push({
            title: 'Check import path',
            description: 'Verify the import path is correct relative to current file'
          });
        }
        break;

      default:
        suggestions.push({
          title: 'Check TypeScript documentation',
          description: `Look up error ${errorCode} in TypeScript documentation`,
          command: `https://www.typescriptlang.org/docs/`
        });
    }

    return suggestions;
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

/**
 * Convenience function to parse TypeScript compiler errors from tsc output
 */
export const parseTypeScriptErrors = (tscOutput: string): FormattedError[] => {
  return defaultErrorFormatter.parseTypeScriptErrors(tscOutput);
};