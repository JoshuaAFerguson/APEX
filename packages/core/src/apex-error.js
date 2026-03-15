"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPInstallationError = exports.PermissionRevokedError = exports.ApexError = exports.ApexErrorContextSchema = exports.ApexErrorCode = void 0;
exports.isApexError = isApexError;
exports.toApexError = toApexError;
exports.wrapWithApexError = wrapWithApexError;
exports.sanitizeErrorMessage = sanitizeErrorMessage;
exports.toSafeErrorResponse = toSafeErrorResponse;
exports.isPermissionRevokedError = isPermissionRevokedError;
exports.isMCPInstallationError = isMCPInstallationError;
const zod_1 = require("zod");
// ============================================================================
// Error Codes
// ============================================================================
/**
 * APEX-specific error codes for categorizing errors
 */
var ApexErrorCode;
(function (ApexErrorCode) {
    // General errors (1000-1099)
    ApexErrorCode["UNKNOWN"] = "APEX_1000";
    ApexErrorCode["INTERNAL"] = "APEX_1001";
    ApexErrorCode["VALIDATION"] = "APEX_1002";
    ApexErrorCode["CONFIGURATION"] = "APEX_1003";
    // Task execution errors (1100-1199)
    ApexErrorCode["TASK_NOT_FOUND"] = "APEX_1100";
    ApexErrorCode["TASK_EXECUTION_FAILED"] = "APEX_1101";
    ApexErrorCode["TASK_TIMEOUT"] = "APEX_1102";
    ApexErrorCode["TASK_CANCELLED"] = "APEX_1103";
    ApexErrorCode["TASK_VALIDATION_FAILED"] = "APEX_1104";
    // Agent errors (1200-1299)
    ApexErrorCode["AGENT_NOT_FOUND"] = "APEX_1200";
    ApexErrorCode["AGENT_INITIALIZATION_FAILED"] = "APEX_1201";
    ApexErrorCode["AGENT_EXECUTION_FAILED"] = "APEX_1202";
    ApexErrorCode["AGENT_COMMUNICATION_FAILED"] = "APEX_1203";
    // Workflow errors (1300-1399)
    ApexErrorCode["WORKFLOW_NOT_FOUND"] = "APEX_1300";
    ApexErrorCode["WORKFLOW_VALIDATION_FAILED"] = "APEX_1301";
    ApexErrorCode["WORKFLOW_EXECUTION_FAILED"] = "APEX_1302";
    ApexErrorCode["WORKFLOW_STAGE_FAILED"] = "APEX_1303";
    // File system errors (1400-1499)
    ApexErrorCode["FILE_NOT_FOUND"] = "APEX_1400";
    ApexErrorCode["FILE_ACCESS_DENIED"] = "APEX_1401";
    ApexErrorCode["DIRECTORY_NOT_FOUND"] = "APEX_1402";
    ApexErrorCode["WORKSPACE_NOT_INITIALIZED"] = "APEX_1403";
    // API/Network errors (1500-1599)
    ApexErrorCode["NETWORK_ERROR"] = "APEX_1500";
    ApexErrorCode["API_ERROR"] = "APEX_1501";
    ApexErrorCode["AUTHENTICATION_ERROR"] = "APEX_1502";
    ApexErrorCode["RATE_LIMIT_EXCEEDED"] = "APEX_1503";
    // Database errors (1600-1699)
    ApexErrorCode["DATABASE_CONNECTION_FAILED"] = "APEX_1600";
    ApexErrorCode["DATABASE_QUERY_FAILED"] = "APEX_1601";
    ApexErrorCode["DATABASE_MIGRATION_FAILED"] = "APEX_1602";
    // Integration errors (1700-1799)
    ApexErrorCode["CLAUDE_SDK_ERROR"] = "APEX_1700";
    ApexErrorCode["TOOL_INTEGRATION_FAILED"] = "APEX_1701";
    ApexErrorCode["DEPENDENCY_ERROR"] = "APEX_1702";
    // Permission errors (1800-1849)
    ApexErrorCode["PERMISSION_REVOKED"] = "APEX_1800";
    ApexErrorCode["PERMISSION_DENIED"] = "APEX_1801";
    ApexErrorCode["PERMISSION_EXPIRED"] = "APEX_1802";
    // Browser errors (1850-1899)
    ApexErrorCode["BROWSER_PERMISSION_DENIED"] = "APEX_1850";
    ApexErrorCode["BROWSER_RESOURCE_LEAK"] = "APEX_1851";
    ApexErrorCode["BROWSER_SESSION_INVALID"] = "APEX_1852";
    // MCP Installation errors (1900-1949)
    ApexErrorCode["MCP_INSTALLATION_FAILED"] = "APEX_1900";
    ApexErrorCode["MCP_PACKAGE_INSTALL_FAILED"] = "APEX_1901";
    ApexErrorCode["MCP_CONFIG_CREATION_FAILED"] = "APEX_1902";
    ApexErrorCode["MCP_DATABASE_RECORD_FAILED"] = "APEX_1903";
    ApexErrorCode["MCP_ROLLBACK_FAILED"] = "APEX_1904";
    ApexErrorCode["MCP_VERIFICATION_FAILED"] = "APEX_1905";
    ApexErrorCode["MCP_SERVER_NOT_FOUND"] = "APEX_1906";
    ApexErrorCode["MCP_ALREADY_INSTALLED"] = "APEX_1907";
    ApexErrorCode["MCP_UNINSTALL_FAILED"] = "APEX_1908";
    ApexErrorCode["MCP_CORRUPTED_INSTALLATION"] = "APEX_1909";
})(ApexErrorCode || (exports.ApexErrorCode = ApexErrorCode = {}));
// ============================================================================
// Error Context Schema
// ============================================================================
/**
 * Context information for debugging and error tracking
 */
exports.ApexErrorContextSchema = zod_1.z.object({
    /** Task ID associated with the error */
    taskId: zod_1.z.string().optional(),
    /** Agent that encountered the error */
    agentId: zod_1.z.string().optional(),
    /** Workflow stage where the error occurred */
    stage: zod_1.z.string().optional(),
    /** Operation being performed when error occurred */
    operation: zod_1.z.string().optional(),
    /** Timestamp when the error occurred */
    timestamp: zod_1.z.date().optional(),
    /** Additional metadata */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Related error IDs */
    relatedErrorIds: zod_1.z.array(zod_1.z.string()).optional(),
    /** User ID if applicable */
    userId: zod_1.z.string().optional(),
    /** Session ID if applicable */
    sessionId: zod_1.z.string().optional(),
});
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
class ApexError extends Error {
    /** APEX-specific error code */
    code;
    /** Context information for debugging */
    context;
    /** Original error that caused this error (if any) */
    cause;
    /** Unique error instance ID */
    errorId;
    /** Timestamp when the error was created */
    timestamp;
    /**
     * Creates a new ApexError instance
     *
     * @param message - Human-readable error message
     * @param code - APEX-specific error code
     * @param context - Additional context information
     * @param cause - Original error that caused this error
     */
    constructor(message, code = ApexErrorCode.UNKNOWN, context = {}, cause) {
        super(message);
        // Set the prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, ApexError.prototype);
        this.name = 'ApexError';
        this.code = code;
        this.context = exports.ApexErrorContextSchema.parse({
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
    generateErrorId() {
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
    isCode(code) {
        return this.code === code;
    }
    /**
     * Check if this error is in a specific category
     *
     * @param prefix - The error code prefix to check (e.g., 'APEX_11' for task errors)
     * @returns true if the error code starts with the prefix
     */
    isCategory(prefix) {
        return this.code.startsWith(prefix);
    }
    /**
     * Get a detailed error object for logging/serialization
     *
     * @returns Object containing all error details
     */
    getDetails() {
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
    toJSON() {
        return this.getDetails();
    }
    /**
     * Create a formatted string representation of the error
     *
     * @param includeStack - Whether to include the stack trace
     * @returns Formatted error string
     */
    toString(includeStack = false) {
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
exports.ApexError = ApexError;
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Type guard to check if an error is an ApexError
 *
 * @param error - The error to check
 * @returns true if the error is an ApexError
 */
function isApexError(error) {
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
function toApexError(error, code = ApexErrorCode.UNKNOWN, context = {}) {
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
function wrapWithApexError(fn, code = ApexErrorCode.UNKNOWN, context = {}) {
    return ((...args) => {
        try {
            const result = fn(...args);
            // Handle async functions
            if (result && typeof result.catch === 'function') {
                return result.catch((error) => {
                    throw toApexError(error, code, context);
                });
            }
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                throw toApexError(error, code, context);
            }
            throw new ApexError(String(error), code, context);
        }
    });
}
// ============================================================================
// Error Sanitization Utilities
// ============================================================================
/**
 * Patterns that indicate sensitive filesystem paths in error messages
 */
const SENSITIVE_PATH_PATTERNS = [
    /\/Users\/[^\s/]+\//g, // macOS home directories
    /\/home\/[^\s/]+\//g, // Linux home directories
    /[A-Z]:\\Users\\[^\s\\]+\\/gi, // Windows home directories
    /node_modules\/[^\s]*/g, // Internal dependency paths
    /\.apex\/(config\.yaml|apex\.db)/g, // APEX internal config/db paths
    /\/tmp\/[^\s]*/g, // Temporary file paths
    /\/var\/[^\s]*/g, // System paths
];
/**
 * Patterns that indicate credentials or secrets in error messages
 */
const SENSITIVE_VALUE_PATTERNS = [
    /sk-ant-[a-zA-Z0-9-]+/g, // Anthropic API keys
    /sk-[a-zA-Z0-9]{20,}/g, // Generic sk- prefixed keys
    /Bearer\s+[a-zA-Z0-9._-]+/g, // Bearer tokens
    /password[=:]\s*\S+/gi, // Password values
    /postgres:\/\/[^@\s]+@/g, // PostgreSQL connection strings
    /mongodb(\+srv)?:\/\/[^@\s]+@/g, // MongoDB connection strings
    /mysql:\/\/[^@\s]+@/g, // MySQL connection strings
    /redis:\/\/[^@\s]+@/g, // Redis connection strings
    /ANTHROPIC_API_KEY\s*[=:]\s*\S+/g, // Anthropic env var with value
    /(?:api[_-]?key|secret|token|credential)[=:]\s*\S+/gi, // Generic secrets
];
/**
 * Generic safe messages for security-sensitive error codes
 */
const SAFE_ERROR_MESSAGES = {
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
function sanitizeErrorMessage(message) {
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
function toSafeErrorResponse(error) {
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
class PermissionRevokedError extends ApexError {
    /** Static code for this specific error type */
    static CODE = ApexErrorCode.PERMISSION_REVOKED;
    constructor(message = 'Permission was revoked during operation', context = {}, cause) {
        super(message, ApexErrorCode.PERMISSION_REVOKED, context, cause);
        this.name = 'PermissionRevokedError';
        // Set the prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, PermissionRevokedError.prototype);
    }
    /** Override code to be the specific PERMISSION_REVOKED value */
    code = ApexErrorCode.PERMISSION_REVOKED;
}
exports.PermissionRevokedError = PermissionRevokedError;
/**
 * Type guard to check if an error is a PermissionRevokedError
 */
function isPermissionRevokedError(error) {
    return error instanceof PermissionRevokedError;
}
/**
 * Specific error class for MCP installation operations
 *
 * This error provides detailed context about MCP installation failures,
 * including rollback information and recovery steps.
 */
class MCPInstallationError extends ApexError {
    installationContext;
    constructor(message, code, context, cause) {
        super(message, code, context, cause);
        this.name = 'MCPInstallationError';
        this.installationContext = context;
        // Set the prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, MCPInstallationError.prototype);
    }
    /** Format user-friendly error message with recovery steps */
    formatUserMessage() {
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
exports.MCPInstallationError = MCPInstallationError;
/**
 * Type guard to check if an error is an MCPInstallationError
 */
function isMCPInstallationError(error) {
    return error instanceof MCPInstallationError;
}
//# sourceMappingURL=apex-error.js.map