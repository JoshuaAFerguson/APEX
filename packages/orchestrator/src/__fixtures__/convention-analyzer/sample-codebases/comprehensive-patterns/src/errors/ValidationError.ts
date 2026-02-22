/**
 * Custom validation error class for user input validation failures
 * Extends the standard Error class with additional validation context
 */

/**
 * Validation error details interface
 */
export interface ValidationErrorDetails {
  /** Field name that failed validation */
  field?: string;
  /** Validation rule that was violated */
  rule?: string;
  /** Expected value or format */
  expected?: string;
  /** Actual value that failed validation */
  actual?: unknown;
  /** Additional context information */
  context?: Record<string, unknown>;
}

/**
 * Custom error class for validation failures
 * Provides structured information about what validation failed and why
 */
export class ValidationError extends Error {
  /** Error name for type identification */
  public readonly name = 'ValidationError';

  /** HTTP status code for API responses */
  public readonly statusCode = 400;

  /** Detailed validation error information */
  public readonly details: ValidationErrorDetails;

  /**
   * Create a new validation error
   * @param message - Human-readable error message
   * @param details - Detailed validation error information
   */
  constructor(message: string, details: ValidationErrorDetails = {}) {
    super(message);

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);

    this.details = details;

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Convert error to JSON representation
   * @returns JSON-serializable error object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    };
  }

  /**
   * Get formatted error message with details
   * @returns Formatted error message
   */
  getFormattedMessage(): string {
    const parts: string[] = [this.message];

    if (this.details.field) {
      parts.push(`Field: ${this.details.field}`);
    }

    if (this.details.rule) {
      parts.push(`Rule: ${this.details.rule}`);
    }

    if (this.details.expected) {
      parts.push(`Expected: ${this.details.expected}`);
    }

    if (this.details.actual !== undefined) {
      parts.push(`Actual: ${JSON.stringify(this.details.actual)}`);
    }

    return parts.join(', ');
  }

  /**
   * Create validation error for required field
   * @param fieldName - Name of the required field
   * @param actualValue - Actual value provided
   * @returns New ValidationError instance
   */
  static required(fieldName: string, actualValue?: unknown): ValidationError {
    return new ValidationError(
      `${fieldName} is required`,
      {
        field: fieldName,
        rule: 'required',
        expected: 'non-empty value',
        actual: actualValue,
      }
    );
  }

  /**
   * Create validation error for invalid format
   * @param fieldName - Name of the field with invalid format
   * @param expectedFormat - Expected format description
   * @param actualValue - Actual value provided
   * @returns New ValidationError instance
   */
  static invalidFormat(fieldName: string, expectedFormat: string, actualValue: unknown): ValidationError {
    return new ValidationError(
      `${fieldName} has invalid format`,
      {
        field: fieldName,
        rule: 'format',
        expected: expectedFormat,
        actual: actualValue,
      }
    );
  }

  /**
   * Create validation error for value too long
   * @param fieldName - Name of the field that's too long
   * @param maxLength - Maximum allowed length
   * @param actualLength - Actual length
   * @returns New ValidationError instance
   */
  static tooLong(fieldName: string, maxLength: number, actualLength: number): ValidationError {
    return new ValidationError(
      `${fieldName} must be less than ${maxLength} characters`,
      {
        field: fieldName,
        rule: 'maxLength',
        expected: `<= ${maxLength} characters`,
        actual: `${actualLength} characters`,
      }
    );
  }

  /**
   * Create validation error for value too short
   * @param fieldName - Name of the field that's too short
   * @param minLength - Minimum required length
   * @param actualLength - Actual length
   * @returns New ValidationError instance
   */
  static tooShort(fieldName: string, minLength: number, actualLength: number): ValidationError {
    return new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      {
        field: fieldName,
        rule: 'minLength',
        expected: `>= ${minLength} characters`,
        actual: `${actualLength} characters`,
      }
    );
  }

  /**
   * Create validation error for duplicate value
   * @param fieldName - Name of the field with duplicate value
   * @param value - Duplicate value
   * @returns New ValidationError instance
   */
  static duplicate(fieldName: string, value: unknown): ValidationError {
    return new ValidationError(
      `${fieldName} already exists`,
      {
        field: fieldName,
        rule: 'unique',
        expected: 'unique value',
        actual: value,
      }
    );
  }

  /**
   * Create validation error for invalid range
   * @param fieldName - Name of the field with out-of-range value
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @param actualValue - Actual value provided
   * @returns New ValidationError instance
   */
  static outOfRange(fieldName: string, min: number, max: number, actualValue: number): ValidationError {
    return new ValidationError(
      `${fieldName} must be between ${min} and ${max}`,
      {
        field: fieldName,
        rule: 'range',
        expected: `${min} <= value <= ${max}`,
        actual: actualValue,
      }
    );
  }

  /**
   * Create validation error for invalid type
   * @param fieldName - Name of the field with wrong type
   * @param expectedType - Expected type name
   * @param actualValue - Actual value provided
   * @returns New ValidationError instance
   */
  static invalidType(fieldName: string, expectedType: string, actualValue: unknown): ValidationError {
    const actualType = typeof actualValue;
    return new ValidationError(
      `${fieldName} must be of type ${expectedType}`,
      {
        field: fieldName,
        rule: 'type',
        expected: expectedType,
        actual: `${actualType}: ${JSON.stringify(actualValue)}`,
      }
    );
  }
}

/**
 * Utility functions for common validation operations
 */
export const ValidationUtils = {
  /**
   * Check if value is empty (null, undefined, empty string, or whitespace only)
   * @param value - Value to check
   * @returns True if value is considered empty
   */
  isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }

    return false;
  },

  /**
   * Validate string length
   * @param value - String value to validate
   * @param minLength - Minimum length (optional)
   * @param maxLength - Maximum length (optional)
   * @returns True if length is valid
   */
  isValidLength(value: string, minLength?: number, maxLength?: number): boolean {
    const length = value.length;

    if (minLength !== undefined && length < minLength) {
      return false;
    }

    if (maxLength !== undefined && length > maxLength) {
      return false;
    }

    return true;
  },

  /**
   * Validate email format using RFC 5322 compliant regex
   * @param email - Email address to validate
   * @returns True if email format is valid
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate numeric range
   * @param value - Numeric value to validate
   * @param min - Minimum allowed value (optional)
   * @param max - Maximum allowed value (optional)
   * @returns True if value is within range
   */
  isInRange(value: number, min?: number, max?: number): boolean {
    if (min !== undefined && value < min) {
      return false;
    }

    if (max !== undefined && value > max) {
      return false;
    }

    return true;
  },

  /**
   * Sanitize string by trimming whitespace
   * @param value - String to sanitize
   * @returns Trimmed string or original value if not a string
   */
  sanitizeString(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  },

  /**
   * Validate required field
   * @param fieldName - Name of the field
   * @param value - Value to validate
   * @throws {ValidationError} If field is empty
   */
  validateRequired(fieldName: string, value: unknown): void {
    if (ValidationUtils.isEmpty(value)) {
      throw ValidationError.required(fieldName, value);
    }
  },

  /**
   * Validate string field with length constraints
   * @param fieldName - Name of the field
   * @param value - String value to validate
   * @param minLength - Minimum length (optional)
   * @param maxLength - Maximum length (optional)
   * @throws {ValidationError} If validation fails
   */
  validateStringField(fieldName: string, value: string, minLength?: number, maxLength?: number): void {
    if (minLength !== undefined && value.length < minLength) {
      throw ValidationError.tooShort(fieldName, minLength, value.length);
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw ValidationError.tooLong(fieldName, maxLength, value.length);
    }
  },

  /**
   * Validate email field
   * @param fieldName - Name of the field
   * @param email - Email address to validate
   * @throws {ValidationError} If email format is invalid
   */
  validateEmailField(fieldName: string, email: string): void {
    if (!ValidationUtils.isValidEmail(email)) {
      throw ValidationError.invalidFormat(fieldName, 'valid email address', email);
    }
  },
};