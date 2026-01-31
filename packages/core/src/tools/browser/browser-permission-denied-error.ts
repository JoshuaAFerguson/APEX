/**
 * @fileoverview Browser Permission Denied Error
 *
 * This module provides a specialized error class for browser permission denied scenarios.
 * The error includes context about the operation, target, and denial reason for better
 * debugging and user feedback.
 *
 * @module @apex/core/tools/browser/browser-permission-denied-error
 */

import { ApexError, ApexErrorCode, type ApexErrorContext } from '../../apex-error.js';

// ============================================================================
// Lifecycle State Types
// ============================================================================

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

// ============================================================================
// Resource State Tracking
// ============================================================================

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

// ============================================================================
// Error Context Types
// ============================================================================

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
export class BrowserPermissionDeniedError extends ApexError {
  /** Browser-specific context information */
  public readonly browserContext: BrowserPermissionDeniedContext;

  /**
   * Creates a new BrowserPermissionDeniedError instance
   *
   * @param message - Human-readable error message describing the permission denial
   * @param context - Browser-specific context information
   * @param cause - Original error that caused this error (if any)
   */
  constructor(
    message: string,
    context: BrowserPermissionDeniedContext = {},
    cause?: Error
  ) {
    // Create enhanced message with operation and target context
    const enhancedMessage = BrowserPermissionDeniedError.createEnhancedMessage(message, context);

    super(
      enhancedMessage,
      ApexErrorCode.BROWSER_PERMISSION_DENIED,
      context,
      cause
    );

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
  private static createEnhancedMessage(
    baseMessage: string,
    context: BrowserPermissionDeniedContext
  ): string {
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
  public isPermissionType(permissionType: BrowserPermissionDeniedContext['permissionType']): boolean {
    return this.browserContext.permissionType === permissionType;
  }

  /**
   * Check if this error is for a specific browser operation
   *
   * @param operation - The operation to check against
   * @returns true if the error is for the specified operation
   */
  public isOperation(operation: string): boolean {
    return this.browserContext.operation === operation;
  }

  /**
   * Get a user-friendly error message suitable for display
   *
   * @returns A formatted error message for end users
   */
  public getUserFriendlyMessage(): string {
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
  public getResolutionSuggestions(): string[] {
    const { permissionType, denialReason } = this.browserContext;
    const suggestions: string[] = [];

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
  public static fromBrowserPermissionError(
    permissionName: string,
    operation: string,
    target?: string,
    originalError?: Error
  ): BrowserPermissionDeniedError {
    const permissionType = BrowserPermissionDeniedError.mapPermissionName(permissionName);

    return new BrowserPermissionDeniedError(
      `Browser permission '${permissionName}' was denied`,
      {
        operation,
        target,
        permissionType,
        denialReason: originalError?.message || 'Permission denied by browser',
      },
      originalError
    );
  }

  /**
   * Create a BrowserPermissionDeniedError for domain restrictions
   *
   * @param domain - The domain that was blocked
   * @param operation - The browser operation being performed
   * @param reason - The specific reason for the domain restriction
   * @returns A new BrowserPermissionDeniedError instance
   */
  public static forDomainRestriction(
    domain: string,
    operation: string,
    reason: string
  ): BrowserPermissionDeniedError {
    return new BrowserPermissionDeniedError(
      `Access to domain '${domain}' was denied`,
      {
        operation,
        target: domain,
        permissionType: 'domain',
        denialReason: reason,
      }
    );
  }

  /**
   * Create a BrowserPermissionDeniedError for disabled tool features
   *
   * @param feature - The feature that is disabled
   * @param operation - The browser operation being performed
   * @returns A new BrowserPermissionDeniedError instance
   */
  public static forDisabledFeature(
    feature: 'javascript' | 'form' | 'screenshots',
    operation: string
  ): BrowserPermissionDeniedError {
    const permissionType = feature === 'screenshots' ? 'storage' : feature;

    return new BrowserPermissionDeniedError(
      `Feature '${feature}' is disabled`,
      {
        operation,
        permissionType,
        denialReason: `${feature} execution is disabled in tool configuration`,
      }
    );
  }

  /**
   * Map browser permission names to our permission types
   *
   * @param permissionName - The browser permission name
   * @returns The corresponding permission type
   */
  private static mapPermissionName(
    permissionName: string
  ): BrowserPermissionDeniedContext['permissionType'] {
    const mapping: Record<string, BrowserPermissionDeniedContext['permissionType']> = {
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

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard to check if an error is a BrowserPermissionDeniedError
 *
 * @param error - The error to check
 * @returns true if the error is a BrowserPermissionDeniedError
 */
export function isBrowserPermissionDeniedError(error: unknown): error is BrowserPermissionDeniedError {
  return error instanceof BrowserPermissionDeniedError;
}

/**
 * Convert any error to a BrowserPermissionDeniedError
 *
 * @param error - The error to convert
 * @param context - Additional browser context information
 * @returns A new BrowserPermissionDeniedError instance
 */
export function toBrowserPermissionDeniedError(
  error: Error,
  context: BrowserPermissionDeniedContext = {}
): BrowserPermissionDeniedError {
  if (isBrowserPermissionDeniedError(error)) {
    return error;
  }

  return new BrowserPermissionDeniedError(error.message, context, error);
}