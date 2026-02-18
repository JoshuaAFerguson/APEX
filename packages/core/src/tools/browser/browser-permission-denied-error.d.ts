/**
 * @fileoverview Browser Permission Denied Error
 *
 * This module provides a specialized error class for browser permission denied scenarios.
 * The error includes context about the operation, target, and denial reason for better
 * debugging and user feedback.
 *
 * @module @apex/core/tools/browser/browser-permission-denied-error
 */
import { ApexError, type ApexErrorContext } from '../../apex-error.js';
/**
 * Represents the lifecycle state of a browser instance.
 *
 * State transitions follow this flow:
 * ```
 * idle → launching → active → cleaning_up → destroyed
 *                      ↓
 *                  cleaning_up → idle (if reusable)
 * ```
 *
 * - `idle`: Browser is initialized but not yet launched or has been reset
 * - `launching`: Browser is in the process of starting up
 * - `active`: Browser is fully operational and ready for interactions
 * - `cleaning_up`: Browser is releasing resources and shutting down
 * - `destroyed`: Browser has been fully terminated and cannot be reused
 */
export type BrowserLifecycleState = 'idle' | 'launching' | 'active' | 'cleaning_up' | 'destroyed';
/**
 * Interface for objects that are aware of browser lifecycle state.
 *
 * Implementing this interface allows components to expose their current
 * lifecycle state and provide a convenience check for whether the browser
 * is currently active and available for operations.
 *
 * @example
 * ```typescript
 * class BrowserSession implements BrowserLifecycleAware {
 *   state: BrowserLifecycleState = 'idle';
 *
 *   isActive(): boolean {
 *     return this.state === 'active';
 *   }
 *
 *   async launch(): Promise<void> {
 *     this.state = 'launching';
 *     // ... launch logic
 *     this.state = 'active';
 *   }
 * }
 * ```
 */
export interface BrowserLifecycleAware {
    /** The current lifecycle state of the browser */
    state: BrowserLifecycleState;
    /**
     * Check whether the browser is currently active and available for operations.
     *
     * @returns true if the browser state is 'active'
     */
    isActive(): boolean;
}
/**
 * Interface for tracking browser resource state to prevent resource leaks
 * on permission denials. This enables proper cleanup when operations fail.
 */
export interface BrowserResourceState {
    /** Whether a browser instance is currently active */
    browserActive: boolean;
    /** Whether a browser context is currently active */
    contextActive: boolean;
    /** Whether a page instance is currently active */
    pageActive: boolean;
    /** Current URL if page is active */
    currentUrl?: string;
    /** Timestamp when resources were last allocated */
    lastAllocation?: Date;
    /** Identifier for the browser session */
    sessionId?: string;
    /** Number of active operations */
    activeOperations: number;
    /** Optional lifecycle state for tracking browser launch/teardown phases */
    lifecycleState?: BrowserLifecycleState;
}
/**
 * Context information specific to browser permission denied errors
 */
export interface BrowserPermissionDeniedContext extends ApexErrorContext {
    /** The browser operation that was denied */
    operation?: string;
    /** The target URL, domain, or selector that was accessed */
    target?: string;
    /** The specific reason for the denial */
    denialReason?: string;
    /** The permission type that was denied */
    permissionType?: 'geolocation' | 'camera' | 'microphone' | 'notifications' | 'clipboard' | 'storage' | 'domain' | 'javascript' | 'form' | 'unknown';
    /** The browser or user agent information */
    userAgent?: string;
}
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
export declare class BrowserPermissionDeniedError extends ApexError {
    /** Browser-specific context information */
    readonly browserContext: BrowserPermissionDeniedContext;
    /**
     * Creates a new BrowserPermissionDeniedError instance
     *
     * @param message - Human-readable error message describing the permission denial
     * @param context - Browser-specific context information
     * @param cause - Original error that caused this error (if any)
     */
    constructor(message: string, context?: BrowserPermissionDeniedContext, cause?: Error);
    /**
     * Creates an enhanced error message with operation and target context
     *
     * @param baseMessage - The base error message
     * @param context - Browser permission context
     * @returns Enhanced error message with context
     */
    private static createEnhancedMessage;
    /**
     * Check if this error is for a specific permission type
     *
     * @param permissionType - The permission type to check against
     * @returns true if the error is for the specified permission type
     */
    isPermissionType(permissionType: BrowserPermissionDeniedContext['permissionType']): boolean;
    /**
     * Check if this error is for a specific browser operation
     *
     * @param operation - The operation to check against
     * @returns true if the error is for the specified operation
     */
    isOperation(operation: string): boolean;
    /**
     * Get a user-friendly error message suitable for display
     *
     * @returns A formatted error message for end users
     */
    getUserFriendlyMessage(): string;
    /**
     * Get suggestions for resolving the permission issue
     *
     * @returns Array of suggested actions to resolve the permission denial
     */
    getResolutionSuggestions(): string[];
    /**
     * Create a BrowserPermissionDeniedError from a browser permission API error
     *
     * @param permissionName - The name of the permission that was denied
     * @param operation - The browser operation being performed
     * @param target - The target of the operation (URL, selector, etc.)
     * @param originalError - The original permission error from the browser
     * @returns A new BrowserPermissionDeniedError instance
     */
    static fromBrowserPermissionError(permissionName: string, operation: string, target?: string, originalError?: Error): BrowserPermissionDeniedError;
    /**
     * Create a BrowserPermissionDeniedError for domain restrictions
     *
     * @param domain - The domain that was blocked
     * @param operation - The browser operation being performed
     * @param reason - The specific reason for the domain restriction
     * @returns A new BrowserPermissionDeniedError instance
     */
    static forDomainRestriction(domain: string, operation: string, reason: string): BrowserPermissionDeniedError;
    /**
     * Create a BrowserPermissionDeniedError for disabled tool features
     *
     * @param feature - The feature that is disabled
     * @param operation - The browser operation being performed
     * @returns A new BrowserPermissionDeniedError instance
     */
    static forDisabledFeature(feature: 'javascript' | 'form' | 'screenshots', operation: string): BrowserPermissionDeniedError;
    /**
     * Map browser permission names to our permission types
     *
     * @param permissionName - The browser permission name
     * @returns The corresponding permission type
     */
    private static mapPermissionName;
}
/**
 * Type guard to check if an error is a BrowserPermissionDeniedError
 *
 * @param error - The error to check
 * @returns true if the error is a BrowserPermissionDeniedError
 */
export declare function isBrowserPermissionDeniedError(error: unknown): error is BrowserPermissionDeniedError;
/**
 * Convert any error to a BrowserPermissionDeniedError
 *
 * @param error - The error to convert
 * @param context - Additional browser context information
 * @returns A new BrowserPermissionDeniedError instance
 */
export declare function toBrowserPermissionDeniedError(error: Error, context?: BrowserPermissionDeniedContext): BrowserPermissionDeniedError;
//# sourceMappingURL=browser-permission-denied-error.d.ts.map