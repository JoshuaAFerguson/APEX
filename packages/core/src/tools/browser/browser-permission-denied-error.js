"use strict";
/**
 * @fileoverview Browser Permission Denied Error
 *
 * This module provides a specialized error class for browser permission denied scenarios.
 * The error includes context about the operation, target, and denial reason for better
 * debugging and user feedback.
 *
 * @module @apex/core/tools/browser/browser-permission-denied-error
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserPermissionDeniedError = void 0;
exports.isBrowserPermissionDeniedError = isBrowserPermissionDeniedError;
exports.toBrowserPermissionDeniedError = toBrowserPermissionDeniedError;
const apex_error_js_1 = require("../../apex-error.js");
// ============================================================================
// BrowserPermissionDeniedError Class
// ============================================================================
/**
 * Specialized error for browser permission denied scenarios.
 *
 * This error extends ApexError to provide meaningful context for browser permission
 * failures, including operation details, target information, and denial reasons.
 *
 * @example
 * ```typescript
 * // Basic usage
 * throw new BrowserPermissionDeniedError('Geolocation access denied');
 *
 * // With operation context
 * throw new BrowserPermissionDeniedError('Navigation blocked', {
 *   operation: 'navigate',
 *   target: 'https://restricted-site.com',
 *   denialReason: 'Domain not in allowed list',
 *   permissionType: 'domain'
 * });
 *
 * // With full context
 * throw new BrowserPermissionDeniedError(
 *   'JavaScript execution denied',
 *   {
 *     operation: 'evaluate',
 *     target: 'document.querySelector',
 *     denialReason: 'JavaScript execution disabled in tool configuration',
 *     permissionType: 'javascript',
 *     taskId: 'task-123',
 *     agentId: 'browser-agent'
 *   }
 * );
 * ```
 */
class BrowserPermissionDeniedError extends apex_error_js_1.ApexError {
    /** Browser-specific context information */
    browserContext;
    /**
     * Creates a new BrowserPermissionDeniedError instance
     *
     * @param message - Human-readable error message describing the permission denial
     * @param context - Browser-specific context information
     * @param cause - Original error that caused this error (if any)
     */
    constructor(message, context = {}, cause) {
        // Create enhanced message with operation and target context
        const enhancedMessage = BrowserPermissionDeniedError.createEnhancedMessage(message, context);
        super(enhancedMessage, apex_error_js_1.ApexErrorCode.BROWSER_PERMISSION_DENIED, context, cause);
        // Set the prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, BrowserPermissionDeniedError.prototype);
        this.name = 'BrowserPermissionDeniedError';
        this.browserContext = context;
    }
    /**
     * Creates an enhanced error message with operation and target context
     *
     * @param baseMessage - The base error message
     * @param context - Browser permission context
     * @returns Enhanced error message with context
     */
    static createEnhancedMessage(baseMessage, context) {
        const parts = [baseMessage];
        if (context.operation) {
            parts.push(`(Operation: ${context.operation})`);
        }
        if (context.target) {
            parts.push(`(Target: ${context.target})`);
        }
        if (context.denialReason) {
            parts.push(`(Reason: ${context.denialReason})`);
        }
        return parts.join(' ');
    }
    /**
     * Check if this error is for a specific permission type
     *
     * @param permissionType - The permission type to check against
     * @returns true if the error is for the specified permission type
     */
    isPermissionType(permissionType) {
        return this.browserContext.permissionType === permissionType;
    }
    /**
     * Check if this error is for a specific browser operation
     *
     * @param operation - The operation to check against
     * @returns true if the error is for the specified operation
     */
    isOperation(operation) {
        return this.browserContext.operation === operation;
    }
    /**
     * Get a user-friendly error message suitable for display
     *
     * @returns A formatted error message for end users
     */
    getUserFriendlyMessage() {
        const { operation, permissionType, denialReason } = this.browserContext;
        // Provide user-friendly messages based on permission type
        switch (permissionType) {
            case 'geolocation':
                return 'Location access was denied. Please allow location permissions in your browser settings.';
            case 'camera':
                return 'Camera access was denied. Please allow camera permissions in your browser settings.';
            case 'microphone':
                return 'Microphone access was denied. Please allow microphone permissions in your browser settings.';
            case 'notifications':
                return 'Notification permissions were denied. Please enable notifications in your browser settings.';
            case 'clipboard':
                return 'Clipboard access was denied. Please allow clipboard permissions for this operation.';
            case 'storage':
                return 'Storage access was denied. Please check your browser privacy settings.';
            case 'domain':
                return `Access to the requested domain was blocked by security policies.`;
            case 'javascript':
                return 'JavaScript execution is not permitted for this operation.';
            case 'form':
                return 'Form submission is not permitted for this operation.';
            default:
                if (operation && denialReason) {
                    return `The ${operation} operation was denied: ${denialReason}`;
                }
                return 'Permission was denied for the requested browser operation.';
        }
    }
    /**
     * Get suggestions for resolving the permission issue
     *
     * @returns Array of suggested actions to resolve the permission denial
     */
    getResolutionSuggestions() {
        const { permissionType, denialReason } = this.browserContext;
        const suggestions = [];
        switch (permissionType) {
            case 'geolocation':
                suggestions.push('Enable location permissions in browser settings');
                suggestions.push('Check that the site is allowed to access location');
                break;
            case 'camera':
                suggestions.push('Enable camera permissions in browser settings');
                suggestions.push('Ensure no other applications are using the camera');
                break;
            case 'microphone':
                suggestions.push('Enable microphone permissions in browser settings');
                suggestions.push('Check system audio settings');
                break;
            case 'notifications':
                suggestions.push('Enable notification permissions for this site');
                suggestions.push('Check browser notification settings');
                break;
            case 'clipboard':
                suggestions.push('Use the browser context menu to copy/paste manually');
                suggestions.push('Enable clipboard access permissions');
                break;
            case 'storage':
                suggestions.push('Check browser privacy and storage settings');
                suggestions.push('Clear browser cache and cookies if necessary');
                break;
            case 'domain':
                suggestions.push('Add the domain to the allowed domains list');
                suggestions.push('Contact administrator to update security policies');
                break;
            case 'javascript':
                suggestions.push('Enable JavaScript execution in tool configuration');
                suggestions.push('Use a different operation that does not require JavaScript');
                break;
            case 'form':
                suggestions.push('Enable form submission in tool configuration');
                suggestions.push('Use manual form interaction instead');
                break;
            default:
                suggestions.push('Check browser permissions and security settings');
                suggestions.push('Review tool configuration for permission restrictions');
                if (denialReason) {
                    suggestions.push(`Address the specific issue: ${denialReason}`);
                }
        }
        return suggestions;
    }
    /**
     * Create a BrowserPermissionDeniedError from a browser permission API error
     *
     * @param permissionName - The name of the permission that was denied
     * @param operation - The browser operation being performed
     * @param target - The target of the operation (URL, selector, etc.)
     * @param originalError - The original permission error from the browser
     * @returns A new BrowserPermissionDeniedError instance
     */
    static fromBrowserPermissionError(permissionName, operation, target, originalError) {
        const permissionType = BrowserPermissionDeniedError.mapPermissionName(permissionName);
        return new BrowserPermissionDeniedError(`Browser permission '${permissionName}' was denied`, {
            operation,
            target,
            permissionType,
            denialReason: originalError?.message || 'Permission denied by browser',
        }, originalError);
    }
    /**
     * Create a BrowserPermissionDeniedError for domain restrictions
     *
     * @param domain - The domain that was blocked
     * @param operation - The browser operation being performed
     * @param reason - The specific reason for the domain restriction
     * @returns A new BrowserPermissionDeniedError instance
     */
    static forDomainRestriction(domain, operation, reason) {
        return new BrowserPermissionDeniedError(`Access to domain '${domain}' was denied`, {
            operation,
            target: domain,
            permissionType: 'domain',
            denialReason: reason,
        });
    }
    /**
     * Create a BrowserPermissionDeniedError for disabled tool features
     *
     * @param feature - The feature that is disabled
     * @param operation - The browser operation being performed
     * @returns A new BrowserPermissionDeniedError instance
     */
    static forDisabledFeature(feature, operation) {
        const permissionType = feature === 'screenshots' ? 'storage' : feature;
        return new BrowserPermissionDeniedError(`Feature '${feature}' is disabled`, {
            operation,
            permissionType,
            denialReason: `${feature} execution is disabled in tool configuration`,
        });
    }
    /**
     * Map browser permission names to our permission types
     *
     * @param permissionName - The browser permission name
     * @returns The corresponding permission type
     */
    static mapPermissionName(permissionName) {
        const mapping = {
            'geolocation': 'geolocation',
            'camera': 'camera',
            'microphone': 'microphone',
            'notifications': 'notifications',
            'clipboard-read': 'clipboard',
            'clipboard-write': 'clipboard',
            'persistent-storage': 'storage',
        };
        return mapping[permissionName.toLowerCase()] || 'unknown';
    }
}
exports.BrowserPermissionDeniedError = BrowserPermissionDeniedError;
// ============================================================================
// Type Guards and Utilities
// ============================================================================
/**
 * Type guard to check if an error is a BrowserPermissionDeniedError
 *
 * @param error - The error to check
 * @returns true if the error is a BrowserPermissionDeniedError
 */
function isBrowserPermissionDeniedError(error) {
    return error instanceof BrowserPermissionDeniedError;
}
/**
 * Convert any error to a BrowserPermissionDeniedError
 *
 * @param error - The error to convert
 * @param context - Additional browser context information
 * @returns A new BrowserPermissionDeniedError instance
 */
function toBrowserPermissionDeniedError(error, context = {}) {
    if (isBrowserPermissionDeniedError(error)) {
        return error;
    }
    return new BrowserPermissionDeniedError(error.message, context, error);
}
//# sourceMappingURL=browser-permission-denied-error.js.map