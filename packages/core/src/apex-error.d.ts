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
/**
 * APEX-specific error codes for categorizing errors
 */
export declare enum ApexErrorCode {
    UNKNOWN = "APEX_1000",
    INTERNAL = "APEX_1001",
    VALIDATION = "APEX_1002",
    CONFIGURATION = "APEX_1003",
    TASK_NOT_FOUND = "APEX_1100",
    TASK_EXECUTION_FAILED = "APEX_1101",
    TASK_TIMEOUT = "APEX_1102",
    TASK_CANCELLED = "APEX_1103",
    TASK_VALIDATION_FAILED = "APEX_1104",
    AGENT_NOT_FOUND = "APEX_1200",
    AGENT_INITIALIZATION_FAILED = "APEX_1201",
    AGENT_EXECUTION_FAILED = "APEX_1202",
    AGENT_COMMUNICATION_FAILED = "APEX_1203",
    WORKFLOW_NOT_FOUND = "APEX_1300",
    WORKFLOW_VALIDATION_FAILED = "APEX_1301",
    WORKFLOW_EXECUTION_FAILED = "APEX_1302",
    WORKFLOW_STAGE_FAILED = "APEX_1303",
    FILE_NOT_FOUND = "APEX_1400",
    FILE_ACCESS_DENIED = "APEX_1401",
    DIRECTORY_NOT_FOUND = "APEX_1402",
    WORKSPACE_NOT_INITIALIZED = "APEX_1403",
    NETWORK_ERROR = "APEX_1500",
    API_ERROR = "APEX_1501",
    AUTHENTICATION_ERROR = "APEX_1502",
    RATE_LIMIT_EXCEEDED = "APEX_1503",
    DATABASE_CONNECTION_FAILED = "APEX_1600",
    DATABASE_QUERY_FAILED = "APEX_1601",
    DATABASE_MIGRATION_FAILED = "APEX_1602",
    CLAUDE_SDK_ERROR = "APEX_1700",
    TOOL_INTEGRATION_FAILED = "APEX_1701",
    DEPENDENCY_ERROR = "APEX_1702",
    PERMISSION_REVOKED = "APEX_1800",
    PERMISSION_DENIED = "APEX_1801",
    PERMISSION_EXPIRED = "APEX_1802",
    BROWSER_PERMISSION_DENIED = "APEX_1850",
    BROWSER_RESOURCE_LEAK = "APEX_1851",
    BROWSER_SESSION_INVALID = "APEX_1852"
}
/**
 * Context information for debugging and error tracking
 */
export declare const ApexErrorContextSchema: z.ZodObject<{
    /** Task ID associated with the error */
    taskId: z.ZodOptional<z.ZodString>;
    /** Agent that encountered the error */
    agentId: z.ZodOptional<z.ZodString>;
    /** Workflow stage where the error occurred */
    stage: z.ZodOptional<z.ZodString>;
    /** Operation being performed when error occurred */
    operation: z.ZodOptional<z.ZodString>;
    /** Timestamp when the error occurred */
    timestamp: z.ZodOptional<z.ZodDate>;
    /** Additional metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Related error IDs */
    relatedErrorIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** User ID if applicable */
    userId: z.ZodOptional<z.ZodString>;
    /** Session ID if applicable */
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    taskId?: string | undefined;
    agentId?: string | undefined;
    stage?: string | undefined;
    operation?: string | undefined;
    timestamp?: Date | undefined;
    metadata?: Record<string, unknown> | undefined;
    relatedErrorIds?: string[] | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
}, {
    taskId?: string | undefined;
    agentId?: string | undefined;
    stage?: string | undefined;
    operation?: string | undefined;
    timestamp?: Date | undefined;
    metadata?: Record<string, unknown> | undefined;
    relatedErrorIds?: string[] | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
}>;
export type ApexErrorContext = z.infer<typeof ApexErrorContextSchema>;
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
export declare class ApexError extends Error {
    /** APEX-specific error code */
    readonly code: ApexErrorCode;
    /** Context information for debugging */
    readonly context: ApexErrorContext;
    /** Original error that caused this error (if any) */
    readonly cause?: Error;
    /** Unique error instance ID */
    readonly errorId: string;
    /** Timestamp when the error was created */
    readonly timestamp: Date;
    /**
     * Creates a new ApexError instance
     *
     * @param message - Human-readable error message
     * @param code - APEX-specific error code
     * @param context - Additional context information
     * @param cause - Original error that caused this error
     */
    constructor(message: string, code?: ApexErrorCode, context?: ApexErrorContext, cause?: Error);
    /**
     * Generate a unique error ID
     *
     * @returns A unique identifier for this error instance
     */
    private generateErrorId;
    /**
     * Check if this error is of a specific type
     *
     * @param code - The error code to check against
     * @returns true if the error code matches
     */
    isCode(code: ApexErrorCode): boolean;
    /**
     * Check if this error is in a specific category
     *
     * @param prefix - The error code prefix to check (e.g., 'APEX_11' for task errors)
     * @returns true if the error code starts with the prefix
     */
    isCategory(prefix: string): boolean;
    /**
     * Get a detailed error object for logging/serialization
     *
     * @returns Object containing all error details
     */
    getDetails(): {
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
    };
    /**
     * Serialize the error to JSON
     *
     * @returns JSON representation of the error
     */
    toJSON(): object;
    /**
     * Create a formatted string representation of the error
     *
     * @param includeStack - Whether to include the stack trace
     * @returns Formatted error string
     */
    toString(includeStack?: boolean): string;
}
/**
 * Type guard to check if an error is an ApexError
 *
 * @param error - The error to check
 * @returns true if the error is an ApexError
 */
export declare function isApexError(error: unknown): error is ApexError;
/**
 * Convert a regular Error to an ApexError
 *
 * @param error - The error to convert
 * @param code - The APEX error code to assign
 * @param context - Additional context information
 * @returns A new ApexError instance
 */
export declare function toApexError(error: Error, code?: ApexErrorCode, context?: ApexErrorContext): ApexError;
/**
 * Wrap a function to convert thrown errors to ApexErrors
 *
 * @param fn - The function to wrap
 * @param code - The default error code for thrown errors
 * @param context - The default context for thrown errors
 * @returns The wrapped function
 */
export declare function wrapWithApexError<T extends (...args: any[]) => any>(fn: T, code?: ApexErrorCode, context?: ApexErrorContext): T;
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
export declare function sanitizeErrorMessage(message: string): string;
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
export declare function toSafeErrorResponse(error: ApexError): {
    errorId: string;
    code: ApexErrorCode;
    message: string;
};
/**
 * Specific error class for permission revocation scenarios
 *
 * This error is thrown when a permission is revoked mid-operation,
 * requiring graceful termination of in-flight requests.
 */
export declare class PermissionRevokedError extends ApexError {
    /** Static code for this specific error type */
    static readonly CODE: ApexErrorCode.PERMISSION_REVOKED;
    constructor(message?: string, context?: ApexErrorContext, cause?: Error);
    /** Override code to be the specific PERMISSION_REVOKED value */
    readonly code: ApexErrorCode;
}
/**
 * Type guard to check if an error is a PermissionRevokedError
 */
export declare function isPermissionRevokedError(error: unknown): error is PermissionRevokedError;
//# sourceMappingURL=apex-error.d.ts.map