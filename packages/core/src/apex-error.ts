/**
 * ApexError - Custom error class for APEX-specific errors
 *
 * This module provides:
 * - ApexError: Custom error class with error codes and context
 * - ApexErrorCode: Enumeration of APEX-specific error codes
 * - ErrorContext: Context information for debugging
 *
 * @module apex-error
 */

import { z } from 'zod';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * APEX-specific error codes for categorizing errors
 */
export enum ApexErrorCode {
  // General errors (1000-1099)
  UNKNOWN = 'APEX_1000',
  INTERNAL = 'APEX_1001',
  VALIDATION = 'APEX_1002',
  CONFIGURATION = 'APEX_1003',

  // Task execution errors (1100-1199)
  TASK_NOT_FOUND = 'APEX_1100',
  TASK_EXECUTION_FAILED = 'APEX_1101',
  TASK_TIMEOUT = 'APEX_1102',
  TASK_CANCELLED = 'APEX_1103',
  TASK_VALIDATION_FAILED = 'APEX_1104',

  // Agent errors (1200-1299)
  AGENT_NOT_FOUND = 'APEX_1200',
  AGENT_INITIALIZATION_FAILED = 'APEX_1201',
  AGENT_EXECUTION_FAILED = 'APEX_1202',
  AGENT_COMMUNICATION_FAILED = 'APEX_1203',

  // Workflow errors (1300-1399)
  WORKFLOW_NOT_FOUND = 'APEX_1300',
  WORKFLOW_VALIDATION_FAILED = 'APEX_1301',
  WORKFLOW_EXECUTION_FAILED = 'APEX_1302',
  WORKFLOW_STAGE_FAILED = 'APEX_1303',

  // File system errors (1400-1499)
  FILE_NOT_FOUND = 'APEX_1400',
  FILE_ACCESS_DENIED = 'APEX_1401',
  DIRECTORY_NOT_FOUND = 'APEX_1402',
  WORKSPACE_NOT_INITIALIZED = 'APEX_1403',

  // API/Network errors (1500-1599)
  NETWORK_ERROR = 'APEX_1500',
  API_ERROR = 'APEX_1501',
  AUTHENTICATION_ERROR = 'APEX_1502',
  RATE_LIMIT_EXCEEDED = 'APEX_1503',

  // Database errors (1600-1699)
  DATABASE_CONNECTION_FAILED = 'APEX_1600',
  DATABASE_QUERY_FAILED = 'APEX_1601',
  DATABASE_MIGRATION_FAILED = 'APEX_1602',

  // Integration errors (1700-1799)
  CLAUDE_SDK_ERROR = 'APEX_1700',
  TOOL_INTEGRATION_FAILED = 'APEX_1701',
  DEPENDENCY_ERROR = 'APEX_1702',

  // Permission errors (1800-1849)
  PERMISSION_REVOKED = 'APEX_1800',
  PERMISSION_DENIED = 'APEX_1801',
  PERMISSION_EXPIRED = 'APEX_1802',

  // Browser errors (1850-1899)
  BROWSER_PERMISSION_DENIED = 'APEX_1850',
  BROWSER_RESOURCE_LEAK = 'APEX_1851',
  BROWSER_SESSION_INVALID = 'APEX_1852',

  // MCP Installation errors (1900-1949)
  MCP_INSTALLATION_FAILED = 'APEX_1900',
  MCP_PACKAGE_INSTALL_FAILED = 'APEX_1901',
  MCP_CONFIG_CREATION_FAILED = 'APEX_1902',
  MCP_DATABASE_RECORD_FAILED = 'APEX_1903',
  MCP_ROLLBACK_FAILED = 'APEX_1904',
  MCP_VERIFICATION_FAILED = 'APEX_1905',
  MCP_SERVER_NOT_FOUND = 'APEX_1906',
  MCP_ALREADY_INSTALLED = 'APEX_1907',
  MCP_UNINSTALL_FAILED = 'APEX_1908',
  MCP_CORRUPTED_INSTALLATION = 'APEX_1909',
}

// ============================================================================
// Error Context Schema
// ============================================================================

/**
 * Context information for debugging and error tracking
 */
export const ApexErrorContextSchema = z.object({
  /** Task ID associated with the error */
  taskId: z.string().optional(),
  /** Agent that encountered the error */
  agentId: z.string().optional(),
  /** Workflow stage where the error occurred */
  stage: z.string().optional(),
  /** Operation being performed when error occurred */
  operation: z.string().optional(),
  /** Timestamp when the error occurred */
  timestamp: z.date().optional(),
  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Related error IDs */
  relatedErrorIds: z.array(z.string()).optional(),
  /** User ID if applicable */
  userId: z.string().optional(),
  /** Session ID if applicable */
  sessionId: z.string().optional(),
});

export type ApexErrorContext = z.infer<typeof ApexErrorContextSchema>;

// ============================================================================
// ApexError Class
// ============================================================================

/**
 * Custom error class for APEX-specific errors
 *
 * Extends the standard Error class with additional metadata and context
 * information for better debugging and error tracking.
 *
 * @example
 * ```typescript
 * // Basic usage
 * throw new ApexError('Task not found', ApexErrorCode.TASK_NOT_FOUND);
 *
 * // With context
 * throw new ApexError(
 *   'Agent execution failed',
 *   ApexErrorCode.AGENT_EXECUTION_FAILED,
 *   { taskId: 'task-123', agentId: 'developer', stage: 'implementation' }
 * );
 *
 * // With cause
 * try {
 *   await riskyOperation();
 * } catch (originalError) {
 *   throw new ApexError(
 *     'Operation failed',
 *     ApexErrorCode.INTERNAL,
 *     { operation: 'riskyOperation' },
 *     originalError
 *   );
 * }
 * ```
 */
export class ApexError extends Error {
  /** APEX-specific error code */
  public readonly code: ApexErrorCode;
  /** Context information for debugging */
  public readonly context: ApexErrorContext;
  /** Original error that caused this error (if any) */
  public readonly cause?: Error;
  /** Unique error instance ID */
  public readonly errorId: string;
  /** Timestamp when the error was created */
  public readonly timestamp: Date;

  /**
   * Creates a new ApexError instance
   *
   * @param message - Human-readable error message
   * @param code - APEX-specific error code
   * @param context - Additional context information
   * @param cause - Original error that caused this error
   */
  constructor(
    message: string,
    code: ApexErrorCode = ApexErrorCode.UNKNOWN,
    context: ApexErrorContext = {},
    cause?: Error
  ) {
    super(message);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, ApexError.prototype);

    this.name = 'ApexError';
    this.code = code;
    this.context = ApexErrorContextSchema.parse({
      ...context,
      timestamp: context.timestamp || new Date(),
    });
    this.cause = cause;
    this.errorId = this.generateErrorId();
    this.timestamp = new Date();

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApexError);
    }
  }

  /**
   * Generate a unique error ID
   *
   * @returns A unique identifier for this error instance
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `apex_err_${timestamp}_${random}`;
  }

  /**
   * Check if this error is of a specific type
   *
   * @param code - The error code to check against
   * @returns true if the error code matches
   */
  public isCode(code: ApexErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if this error is in a specific category
   *
   * @param prefix - The error code prefix to check (e.g., 'APEX_11' for task errors)
   * @returns true if the error code starts with the prefix
   */
  public isCategory(prefix: string): boolean {
    return this.code.startsWith(prefix);
  }

  /**
   * Get a detailed error object for logging/serialization
   *
   * @returns Object containing all error details
   */
  public getDetails(): {
    errorId: string;
    name: string;
    message: string;
    code: ApexErrorCode;
    context: ApexErrorContext;
    timestamp: Date;
    stack?: string;
    cause?: {
      name: string;
      message: string;
      stack?: string;
    };
  } {
    return {
      errorId: this.errorId,
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * Serialize the error to JSON
   *
   * @returns JSON representation of the error
   */
  public toJSON(): object {
    return this.getDetails();
  }

  /**
   * Create a formatted string representation of the error
   *
   * @param includeStack - Whether to include the stack trace
   * @returns Formatted error string
   */
  public toString(includeStack: boolean = false): string {
    let result = `${this.name} [${this.code}]: ${this.message}`;

    if (this.context.taskId) {
      result += ` (Task: ${this.context.taskId})`;
    }

    if (this.context.agentId) {
      result += ` (Agent: ${this.context.agentId})`;
    }

    if (this.context.stage) {
      result += ` (Stage: ${this.context.stage})`;
    }

    if (this.cause) {
      result += `\nCaused by: ${this.cause.name}: ${this.cause.message}`;
    }

    if (includeStack && this.stack) {
      result += `\n${this.stack}`;
    }

    return result;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if an error is an ApexError
 *
 * @param error - The error to check
 * @returns true if the error is an ApexError
 */
export function isApexError(error: unknown): error is ApexError {
  return error instanceof ApexError;
}

/**
 * Convert a regular Error to an ApexError
 *
 * @param error - The error to convert
 * @param code - The APEX error code to assign
 * @param context - Additional context information
 * @returns A new ApexError instance
 */
export function toApexError(
  error: Error,
  code: ApexErrorCode = ApexErrorCode.UNKNOWN,
  context: ApexErrorContext = {}
): ApexError {
  if (isApexError(error)) {
    return error;
  }

  return new ApexError(error.message, code, context, error);
}

/**
 * Wrap a function to convert thrown errors to ApexErrors
 *
 * @param fn - The function to wrap
 * @param code - The default error code for thrown errors
 * @param context - The default context for thrown errors
 * @returns The wrapped function
 */
export function wrapWithApexError<T extends (...args: any[]) => any>(
  fn: T,
  code: ApexErrorCode = ApexErrorCode.UNKNOWN,
  context: ApexErrorContext = {}
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result && typeof result.catch === 'function') {
        return result.catch((error: Error) => {
          throw toApexError(error, code, context);
        });
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw toApexError(error, code, context);
      }
      throw new ApexError(String(error), code, context);
    }
  }) as T;
}

// ============================================================================
// Error Sanitization Utilities
// ============================================================================

/**
 * Patterns that indicate sensitive filesystem paths in error messages
 */
const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /\/Users\/[^\s/]+\//g,         // macOS home directories
  /\/home\/[^\s/]+\//g,          // Linux home directories
  /[A-Z]:\\Users\\[^\s\\]+\\/gi, // Windows home directories
  /node_modules\/[^\s]*/g,       // Internal dependency paths
  /\.apex\/(config\.yaml|apex\.db)/g, // APEX internal config/db paths
  /\/tmp\/[^\s]*/g,              // Temporary file paths
  /\/var\/[^\s]*/g,              // System paths
];

/**
 * Patterns that indicate credentials or secrets in error messages
 */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9-]+/g,                    // Anthropic API keys
  /sk-[a-zA-Z0-9]{20,}/g,                     // Generic sk- prefixed keys
  /Bearer\s+[a-zA-Z0-9._-]+/g,               // Bearer tokens
  /password[=:]\s*\S+/gi,                     // Password values
  /postgres:\/\/[^@\s]+@/g,                   // PostgreSQL connection strings
  /mongodb(\+srv)?:\/\/[^@\s]+@/g,            // MongoDB connection strings
  /mysql:\/\/[^@\s]+@/g,                      // MySQL connection strings
  /redis:\/\/[^@\s]+@/g,                      // Redis connection strings
  /ANTHROPIC_API_KEY\s*[=:]\s*\S+/g,          // Anthropic env var with value
  /(?:api[_-]?key|secret|token|credential)[=:]\s*\S+/gi, // Generic secrets
];

/**
 * Generic safe messages for security-sensitive error codes
 */
const SAFE_ERROR_MESSAGES: Partial<Record<ApexErrorCode, string>> = {
  [ApexErrorCode.AUTHENTICATION_ERROR]: 'Authentication failed',
  [ApexErrorCode.FILE_ACCESS_DENIED]: 'Access denied',
  [ApexErrorCode.DATABASE_CONNECTION_FAILED]: 'Service temporarily unavailable',
  [ApexErrorCode.DATABASE_QUERY_FAILED]: 'Service temporarily unavailable',
  [ApexErrorCode.DATABASE_MIGRATION_FAILED]: 'Service temporarily unavailable',
  [ApexErrorCode.CONFIGURATION]: 'Configuration error',
  [ApexErrorCode.NETWORK_ERROR]: 'Network error',
  [ApexErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded, please try again later',
  [ApexErrorCode.PERMISSION_REVOKED]: 'Permission was revoked',
  [ApexErrorCode.PERMISSION_DENIED]: 'Permission denied',
  [ApexErrorCode.PERMISSION_EXPIRED]: 'Permission has expired',
  [ApexErrorCode.BROWSER_PERMISSION_DENIED]: 'Browser permission denied',
  [ApexErrorCode.BROWSER_RESOURCE_LEAK]: 'Browser resource leak detected',
  [ApexErrorCode.BROWSER_SESSION_INVALID]: 'Browser session is in an invalid state',
};

/**
 * Sanitize an error message for safe external display.
 * Strips internal paths and credential patterns from the message.
 *
 * @param message - The raw error message to sanitize
 * @returns A sanitized message safe for external display
 *
 * @example
 * ```typescript
 * sanitizeErrorMessage('Failed to read /Users/dev/project/.apex/config.yaml')
 * // Returns: 'Failed to read [path]'
 *
 * sanitizeErrorMessage('Auth failed: Bearer eyJhbGci...')
 * // Returns: 'Auth failed: [redacted]'
 * ```
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Replace sensitive paths with [path]
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[path]');
  }

  // Replace sensitive values with [redacted]
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted]');
  }

  return sanitized;
}

/**
 * Get a production-safe representation of an ApexError.
 * Returns only the error code, sanitized message, and errorId.
 * No stack traces, no internal paths, no credentials.
 *
 * @param error - The ApexError to create a safe response for
 * @returns A safe error response object suitable for API responses
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   const apexErr = toApexError(err);
 *   reply.status(500).send(toSafeErrorResponse(apexErr));
 * }
 * ```
 */
export function toSafeErrorResponse(error: ApexError): {
  errorId: string;
  code: ApexErrorCode;
  message: string;
} {
  // Use the generic safe message if one exists for this error code
  const safeMessage = SAFE_ERROR_MESSAGES[error.code];

  return {
    errorId: error.errorId,
    code: error.code,
    message: safeMessage ?? sanitizeErrorMessage(error.message),
  };
}

// ============================================================================
// Permission-specific Error Classes
// ============================================================================

/**
 * Specific error class for permission revocation scenarios
 *
 * This error is thrown when a permission is revoked mid-operation,
 * requiring graceful termination of in-flight requests.
 */
export class PermissionRevokedError extends ApexError {
  /** Static code for this specific error type */
  static readonly CODE = ApexErrorCode.PERMISSION_REVOKED as const;

  constructor(
    message: string = 'Permission was revoked during operation',
    context: ApexErrorContext = {},
    cause?: Error
  ) {
    super(message, ApexErrorCode.PERMISSION_REVOKED, context, cause);
    this.name = 'PermissionRevokedError';

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, PermissionRevokedError.prototype);
  }

  /** Override code to be the specific PERMISSION_REVOKED value */
  public override readonly code: ApexErrorCode = ApexErrorCode.PERMISSION_REVOKED;
}

/**
 * Type guard to check if an error is a PermissionRevokedError
 */
export function isPermissionRevokedError(error: unknown): error is PermissionRevokedError {
  return error instanceof PermissionRevokedError;
}

// ============================================================================
// MCP Installation Error Classes
// ============================================================================

/**
 * Extended context for MCP installation errors
 */
export interface MCPInstallationErrorContext extends ApexErrorContext {
  /** Server ID being installed */
  serverId?: string;
  /** Installation ID if created */
  installationId?: string;
  /** Package name being installed */
  packageName?: string;
  /** Installation step that failed */
  failedStep?: 'npm_install' | 'config_creation' | 'database_record' | 'verification';
  /** Rollback actions attempted */
  rollbackAttempts?: {
    step: string;
    success: boolean;
    error?: string;
  }[];
  /** Recommended recovery actions */
  recoverySteps?: string[];
}

/**
 * Specific error class for MCP installation operations
 *
 * This error provides detailed context about MCP installation failures,
 * including rollback information and recovery steps.
 */
export class MCPInstallationError extends ApexError {
  public readonly installationContext: MCPInstallationErrorContext;

  constructor(
    message: string,
    code: ApexErrorCode,
    context: MCPInstallationErrorContext,
    cause?: Error
  ) {
    super(message, code, context, cause);
    this.name = 'MCPInstallationError';
    this.installationContext = context;

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, MCPInstallationError.prototype);
  }

  /** Format user-friendly error message with recovery steps */
  public formatUserMessage(): string {
    let msg = this.message;
    if (this.installationContext.recoverySteps?.length) {
      msg += '\n\nSuggested recovery steps:\n';
      this.installationContext.recoverySteps.forEach((step, i) => {
        msg += `  ${i + 1}. ${step}\n`;
      });
    }
    return msg;
  }
}

/**
 * Type guard to check if an error is an MCPInstallationError
 */
export function isMCPInstallationError(error: unknown): error is MCPInstallationError {
  return error instanceof MCPInstallationError;
}