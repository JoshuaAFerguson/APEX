/**
 * @fileoverview User Response Simulation Utilities for Testing
 *
 * This module provides utilities for simulating user responses in confirmation flows
 * during automated testing. It integrates with the orchestrator's event system to
 * intercept and automatically respond to approval, permission, and dangerous operation
 * confirmation requests.
 *
 * ## Architecture Overview
 *
 * The simulator works by:
 * 1. Listening to orchestrator events (approval:required, permission:request, dangerous:detected)
 * 2. Matching events against configured response patterns
 * 3. Automatically calling the appropriate orchestrator methods to respond
 *
 * ## Key Components
 *
 * - ConfirmationSimulator: Main class that manages event listeners and response queue
 * - Response Types: simulateUserApproval, simulateUserDenial, simulateTimeout
 * - Batch Mode: simulateBatchResponses for complex multi-step confirmation scenarios
 *
 * ## Usage Patterns
 *
 * ### Synchronous (Pre-configured)
 * ```typescript
 * const simulator = new ConfirmationSimulator(orchestrator);
 * simulator.simulateUserApproval('approval-123', { approver: 'test-user' });
 * await orchestrator.runTask(taskId); // Will auto-approve when approval is requested
 * ```
 *
 * ### Asynchronous (Promise-based)
 * ```typescript
 * const simulator = new ConfirmationSimulator(orchestrator);
 * const approvalPromise = simulator.waitForApprovalRequest();
 * orchestrator.runTask(taskId);
 * const request = await approvalPromise;
 * simulator.simulateUserApproval(request.approvalId);
 * ```
 *
 * @module tests/utils/confirmation-simulator
 * @version 1.0.0
 */

import type { EventEmitter } from 'eventemitter3';
import type {
  ApprovalResponse,
  ApprovalState,
  PermissionLevel,
} from '@apexcli/core';
import type {
  ApexOrchestrator,
  OrchestratorEvents,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  ApprovalRequiredEventData,
} from '@apexcli/orchestrator';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration options for simulating user approval
 */
export interface ApprovalSimulationOptions {
  /** Who is approving (default: 'test-simulator') */
  approver?: string;
  /** Optional comment/reason for approval */
  comment?: string;
  /** Delay in ms before responding (default: 0) */
  delayMs?: number;
}

/**
 * Configuration options for simulating user denial
 */
export interface DenialSimulationOptions {
  /** Who is denying (default: 'test-simulator') */
  denier?: string;
  /** Reason for denial (required for denials) */
  reason?: string;
  /** Delay in ms before responding (default: 0) */
  delayMs?: number;
}

/**
 * Configuration options for simulating timeout
 */
export interface TimeoutSimulationOptions {
  /** Timeout duration in ms */
  timeoutMs: number;
  /** Action to take on timeout: 'reject' (default), 'approve', or 'escalate' */
  timeoutAction?: 'reject' | 'approve' | 'escalate';
  /** Optional message for timeout resolution */
  message?: string;
}

/**
 * A single batch response configuration
 */
export interface BatchResponseConfig {
  /** Type of confirmation to respond to */
  type: 'approval' | 'permission' | 'dangerous-operation';
  /** Pattern to match (requestId, tool name, or operation) */
  matchPattern?: string | RegExp;
  /** Response action */
  action: 'approve' | 'deny' | 'timeout';
  /** Options for the response */
  options?: ApprovalSimulationOptions | DenialSimulationOptions | TimeoutSimulationOptions;
}

/**
 * Captured request for async response handling
 */
export interface CapturedRequest {
  type: 'approval' | 'permission' | 'dangerous-operation';
  requestId: string;
  timestamp: Date;
  data: ApprovalRequiredEventData | PermissionRequestEventData | DangerousOperationDetectedEventData;
}

/**
 * Response queue entry for pre-configured responses
 */
interface QueuedResponse {
  id: string;
  type: 'approval' | 'permission' | 'dangerous-operation';
  action: 'approve' | 'deny' | 'timeout';
  matchPattern?: string | RegExp;
  options: ApprovalSimulationOptions | DenialSimulationOptions | TimeoutSimulationOptions;
  consumed: boolean;
}

// ============================================================================
// ConfirmationSimulator Class
// ============================================================================

/**
 * Manages simulation of user responses in confirmation flows for testing.
 *
 * The ConfirmationSimulator class provides a comprehensive API for:
 * - Pre-configuring responses that will be automatically applied when requests arrive
 * - Capturing requests for manual/async response handling
 * - Simulating timeouts and various edge cases
 *
 * @example Pre-configured approval
 * ```typescript
 * const simulator = new ConfirmationSimulator(orchestrator);
 *
 * // Configure an approval before running the task
 * simulator.simulateUserApproval('approval-123');
 *
 * // When the task requests approval for 'approval-123', it will be auto-approved
 * await orchestrator.runTask(taskId);
 * ```
 *
 * @example Async/dynamic response
 * ```typescript
 * const simulator = new ConfirmationSimulator(orchestrator);
 *
 * // Start listening for requests
 * const requestPromise = simulator.waitForApprovalRequest();
 *
 * // Start task (non-blocking)
 * const taskPromise = orchestrator.runTask(taskId);
 *
 * // Wait for and respond to the request
 * const request = await requestPromise;
 * simulator.simulateUserApproval(request.requestId);
 *
 * // Wait for task completion
 * await taskPromise;
 * ```
 */
export class ConfirmationSimulator {
  private orchestrator: ApexOrchestrator;
  private responseQueue: QueuedResponse[] = [];
  private capturedRequests: CapturedRequest[] = [];
  private pendingRequestResolvers: Map<string, (request: CapturedRequest) => void> = new Map();
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private eventListenersRegistered = false;

  /**
   * Create a new ConfirmationSimulator
   * @param orchestrator The ApexOrchestrator instance to integrate with
   */
  constructor(orchestrator: ApexOrchestrator) {
    this.orchestrator = orchestrator;
    this.registerEventListeners();
  }

  // ==========================================================================
  // Public API - Synchronous Response Configuration
  // ==========================================================================

  /**
   * Configure an approval response for a specific request or pattern.
   *
   * This method queues an approval response that will be automatically applied
   * when a matching request is received. Responses are matched in FIFO order.
   *
   * @param requestIdOrPattern - Exact request ID or regex pattern to match
   * @param options - Configuration options for the approval
   * @returns The simulator instance for chaining
   *
   * @example With exact ID
   * ```typescript
   * simulator.simulateUserApproval('approval-123');
   * ```
   *
   * @example With pattern matching
   * ```typescript
   * simulator.simulateUserApproval(/^approval-.*$/, {
   *   approver: 'admin@test.com',
   *   comment: 'Batch approved'
   * });
   * ```
   *
   * @example With delay
   * ```typescript
   * simulator.simulateUserApproval('approval-123', { delayMs: 1000 });
   * ```
   */
  simulateUserApproval(
    requestIdOrPattern: string | RegExp,
    options: ApprovalSimulationOptions = {}
  ): this {
    const id = this.generateResponseId();
    this.responseQueue.push({
      id,
      type: 'approval',
      action: 'approve',
      matchPattern: requestIdOrPattern,
      options: {
        approver: 'test-simulator',
        ...options,
      },
      consumed: false,
    });
    return this;
  }

  /**
   * Configure a denial response for a specific request or pattern.
   *
   * This method queues a denial response that will be automatically applied
   * when a matching request is received.
   *
   * @param requestIdOrPattern - Exact request ID or regex pattern to match
   * @param options - Configuration options for the denial
   * @returns The simulator instance for chaining
   *
   * @example
   * ```typescript
   * simulator.simulateUserDenial('approval-456', {
   *   denier: 'security-team',
   *   reason: 'Unsafe operation detected'
   * });
   * ```
   */
  simulateUserDenial(
    requestIdOrPattern: string | RegExp,
    options: DenialSimulationOptions = {}
  ): this {
    const id = this.generateResponseId();
    this.responseQueue.push({
      id,
      type: 'approval',
      action: 'deny',
      matchPattern: requestIdOrPattern,
      options: {
        denier: 'test-simulator',
        reason: 'Denied by test simulator',
        ...options,
      },
      consumed: false,
    });
    return this;
  }

  /**
   * Configure a timeout response for a specific request or pattern.
   *
   * This schedules a timeout that will trigger after the specified duration,
   * simulating a user who doesn't respond in time.
   *
   * @param requestIdOrPattern - Exact request ID or regex pattern to match
   * @param options - Configuration options for the timeout
   * @returns The simulator instance for chaining
   *
   * @example
   * ```typescript
   * simulator.simulateTimeout('approval-789', {
   *   timeoutMs: 5000,
   *   timeoutAction: 'reject',
   *   message: 'No response within timeout period'
   * });
   * ```
   */
  simulateTimeout(
    requestIdOrPattern: string | RegExp,
    options: TimeoutSimulationOptions
  ): this {
    const id = this.generateResponseId();
    this.responseQueue.push({
      id,
      type: 'approval',
      action: 'timeout',
      matchPattern: requestIdOrPattern,
      options: {
        timeoutAction: 'reject',
        ...options,
      },
      consumed: false,
    });
    return this;
  }

  /**
   * Configure multiple responses at once for complex test scenarios.
   *
   * This is useful for tests that involve multiple confirmation steps
   * that need to be handled in sequence.
   *
   * @param responses - Array of batch response configurations
   * @returns The simulator instance for chaining
   *
   * @example
   * ```typescript
   * simulator.simulateBatchResponses([
   *   // First, approve the permission request
   *   {
   *     type: 'permission',
   *     matchPattern: 'Write',
   *     action: 'approve',
   *     options: { approver: 'user' }
   *   },
   *   // Then, approve the approval gate
   *   {
   *     type: 'approval',
   *     matchPattern: /^deploy-gate/,
   *     action: 'approve',
   *     options: { approver: 'tech-lead' }
   *   },
   *   // Finally, deny the dangerous operation
   *   {
   *     type: 'dangerous-operation',
   *     matchPattern: 'rm -rf',
   *     action: 'deny',
   *     options: { reason: 'Too risky' }
   *   }
   * ]);
   * ```
   */
  simulateBatchResponses(responses: BatchResponseConfig[]): this {
    for (const response of responses) {
      const id = this.generateResponseId();
      this.responseQueue.push({
        id,
        type: response.type,
        action: response.action,
        matchPattern: response.matchPattern,
        options: response.options || {},
        consumed: false,
      });
    }
    return this;
  }

  // ==========================================================================
  // Public API - Asynchronous Response Handling
  // ==========================================================================

  /**
   * Wait for the next approval request to be captured.
   *
   * @param timeoutMs - Maximum time to wait (default: 30000ms)
   * @returns Promise that resolves with the captured request
   * @throws Error if timeout expires before a request is received
   *
   * @example
   * ```typescript
   * const request = await simulator.waitForApprovalRequest(5000);
   * console.log(`Received approval request: ${request.requestId}`);
   * simulator.simulateUserApproval(request.requestId);
   * ```
   */
  waitForApprovalRequest(timeoutMs: number = 30000): Promise<CapturedRequest> {
    return this.waitForRequest('approval', timeoutMs);
  }

  /**
   * Wait for the next permission request to be captured.
   *
   * @param timeoutMs - Maximum time to wait (default: 30000ms)
   * @returns Promise that resolves with the captured request
   */
  waitForPermissionRequest(timeoutMs: number = 30000): Promise<CapturedRequest> {
    return this.waitForRequest('permission', timeoutMs);
  }

  /**
   * Wait for the next dangerous operation detection to be captured.
   *
   * @param timeoutMs - Maximum time to wait (default: 30000ms)
   * @returns Promise that resolves with the captured request
   */
  waitForDangerousOperationRequest(timeoutMs: number = 30000): Promise<CapturedRequest> {
    return this.waitForRequest('dangerous-operation', timeoutMs);
  }

  /**
   * Wait for any type of confirmation request.
   *
   * @param type - Type of request to wait for
   * @param timeoutMs - Maximum time to wait
   * @returns Promise that resolves with the captured request
   */
  private waitForRequest(
    type: 'approval' | 'permission' | 'dangerous-operation',
    timeoutMs: number
  ): Promise<CapturedRequest> {
    return new Promise((resolve, reject) => {
      const requestKey = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Check if we already have an unhandled request of this type
      const existingRequest = this.capturedRequests.find(
        (r) => r.type === type
      );
      if (existingRequest) {
        this.capturedRequests = this.capturedRequests.filter(
          (r) => r !== existingRequest
        );
        resolve(existingRequest);
        return;
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequestResolvers.delete(requestKey);
        reject(new Error(`Timeout waiting for ${type} request after ${timeoutMs}ms`));
      }, timeoutMs);

      // Register resolver
      this.pendingRequestResolvers.set(requestKey, (request) => {
        clearTimeout(timeout);
        this.pendingRequestResolvers.delete(requestKey);
        resolve(request);
      });
    });
  }

  // ==========================================================================
  // Public API - Utility Methods
  // ==========================================================================

  /**
   * Get all captured requests that haven't been responded to.
   *
   * @returns Array of captured requests
   */
  getCapturedRequests(): CapturedRequest[] {
    return [...this.capturedRequests];
  }

  /**
   * Get the current response queue.
   *
   * @returns Array of queued responses
   */
  getResponseQueue(): Omit<QueuedResponse, 'consumed'>[] {
    return this.responseQueue.map(({ consumed, ...rest }) => rest);
  }

  /**
   * Clear all pending responses and captured requests.
   *
   * @returns The simulator instance for chaining
   */
  reset(): this {
    this.responseQueue = [];
    this.capturedRequests = [];

    // Cancel any active timeouts
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();

    return this;
  }

  /**
   * Dispose of the simulator and clean up event listeners.
   *
   * Call this when you're done with the simulator to prevent memory leaks.
   */
  dispose(): void {
    this.reset();
    this.unregisterEventListeners();
  }

  // ==========================================================================
  // Private Methods - Event Handling
  // ==========================================================================

  /**
   * Register event listeners on the orchestrator.
   */
  private registerEventListeners(): void {
    if (this.eventListenersRegistered) {
      return;
    }

    this.orchestrator.on('approval:required', this.handleApprovalRequired);
    this.orchestrator.on('permission:request', this.handlePermissionRequest);
    this.orchestrator.on('dangerous:detected', this.handleDangerousDetected);

    this.eventListenersRegistered = true;
  }

  /**
   * Unregister event listeners from the orchestrator.
   */
  private unregisterEventListeners(): void {
    if (!this.eventListenersRegistered) {
      return;
    }

    this.orchestrator.off('approval:required', this.handleApprovalRequired);
    this.orchestrator.off('permission:request', this.handlePermissionRequest);
    this.orchestrator.off('dangerous:detected', this.handleDangerousDetected);

    this.eventListenersRegistered = false;
  }

  /**
   * Handle approval:required events.
   */
  private handleApprovalRequired = async (event: ApprovalRequiredEventData): Promise<void> => {
    const captured: CapturedRequest = {
      type: 'approval',
      requestId: event.approvalId,
      timestamp: new Date(),
      data: event,
    };

    // Check for matching queued response
    const matchedResponse = this.findMatchingResponse('approval', event.approvalId);

    if (matchedResponse) {
      await this.executeResponse(matchedResponse, captured);
    } else {
      // Capture for async handling
      this.captureRequest(captured);
    }
  };

  /**
   * Handle permission:request events.
   */
  private handlePermissionRequest = async (event: PermissionRequestEventData): Promise<void> => {
    const captured: CapturedRequest = {
      type: 'permission',
      requestId: event.requestId,
      timestamp: new Date(),
      data: event,
    };

    // Check for matching queued response (match against requestId or tool name)
    const matchedResponse = this.findMatchingResponse(
      'permission',
      event.requestId,
      event.tool
    );

    if (matchedResponse) {
      await this.executeResponse(matchedResponse, captured);
    } else {
      this.captureRequest(captured);
    }
  };

  /**
   * Handle dangerous:detected events.
   */
  private handleDangerousDetected = async (event: DangerousOperationDetectedEventData): Promise<void> => {
    const captured: CapturedRequest = {
      type: 'dangerous-operation',
      requestId: event.operationId,
      timestamp: new Date(),
      data: event,
    };

    // Check for matching queued response (match against operationId or operation)
    const matchedResponse = this.findMatchingResponse(
      'dangerous-operation',
      event.operationId,
      event.operation
    );

    if (matchedResponse) {
      await this.executeResponse(matchedResponse, captured);
    } else {
      this.captureRequest(captured);
    }
  };

  // ==========================================================================
  // Private Methods - Response Matching and Execution
  // ==========================================================================

  /**
   * Find a matching response in the queue.
   */
  private findMatchingResponse(
    type: 'approval' | 'permission' | 'dangerous-operation',
    primaryId: string,
    secondaryMatch?: string
  ): QueuedResponse | null {
    for (const response of this.responseQueue) {
      if (response.consumed || response.type !== type) {
        continue;
      }

      // No pattern means match any
      if (!response.matchPattern) {
        return response;
      }

      // Check if pattern matches
      if (this.matchesPattern(response.matchPattern, primaryId, secondaryMatch)) {
        return response;
      }
    }

    return null;
  }

  /**
   * Check if a value matches a pattern.
   */
  private matchesPattern(
    pattern: string | RegExp,
    primaryValue: string,
    secondaryValue?: string
  ): boolean {
    if (typeof pattern === 'string') {
      return primaryValue === pattern || secondaryValue === pattern;
    }
    return pattern.test(primaryValue) || (secondaryValue ? pattern.test(secondaryValue) : false);
  }

  /**
   * Execute a queued response.
   */
  private async executeResponse(
    response: QueuedResponse,
    request: CapturedRequest
  ): Promise<void> {
    response.consumed = true;

    const options = response.options as
      | ApprovalSimulationOptions
      | DenialSimulationOptions
      | TimeoutSimulationOptions;

    // Handle delay if specified
    const delayMs = 'delayMs' in options ? options.delayMs ?? 0 : 0;
    if (delayMs > 0) {
      await this.delay(delayMs);
    }

    // Handle timeout action
    if (response.action === 'timeout') {
      const timeoutOpts = options as TimeoutSimulationOptions;
      await this.executeTimeoutAction(request, timeoutOpts);
      return;
    }

    // Execute based on request type and action
    switch (request.type) {
      case 'approval':
        await this.executeApprovalResponse(request, response.action, options);
        break;
      case 'permission':
        await this.executePermissionResponse(request, response.action, options);
        break;
      case 'dangerous-operation':
        await this.executeDangerousOperationResponse(request, response.action, options);
        break;
    }
  }

  /**
   * Execute an approval response.
   */
  private async executeApprovalResponse(
    request: CapturedRequest,
    action: 'approve' | 'deny',
    options: ApprovalSimulationOptions | DenialSimulationOptions
  ): Promise<void> {
    const event = request.data as ApprovalRequiredEventData;

    if (action === 'approve') {
      const approvalOpts = options as ApprovalSimulationOptions;
      const response: ApprovalResponse = {
        requestId: event.approvalId,
        taskId: event.taskId,
        response: 'approved',
        approver: approvalOpts.approver || 'test-simulator',
        message: approvalOpts.comment,
        // Legacy fields for compatibility
        approvalId: event.approvalId,
        gateName: event.gateName,
        action: 'approve',
        timestamp: new Date(),
        requestedAt: event.timestamp,
        resolved: true,
      };

      await this.orchestrator.respondToApproval(event.approvalId, response);
    } else {
      const denialOpts = options as DenialSimulationOptions;
      const response: ApprovalResponse = {
        requestId: event.approvalId,
        taskId: event.taskId,
        response: 'denied',
        approver: denialOpts.denier || 'test-simulator',
        message: denialOpts.reason || 'Denied by test simulator',
        // Legacy fields for compatibility
        approvalId: event.approvalId,
        gateName: event.gateName,
        action: 'deny',
        timestamp: new Date(),
        requestedAt: event.timestamp,
        resolved: true,
      };

      await this.orchestrator.respondToApproval(event.approvalId, response);
    }
  }

  /**
   * Execute a permission response.
   */
  private async executePermissionResponse(
    request: CapturedRequest,
    action: 'approve' | 'deny',
    options: ApprovalSimulationOptions | DenialSimulationOptions
  ): Promise<void> {
    const event = request.data as PermissionRequestEventData;

    if (action === 'approve') {
      const approvalOpts = options as ApprovalSimulationOptions;
      // Emit permission:granted event
      this.orchestrator.emit('permission:granted', {
        requestId: event.requestId,
        tool: event.tool,
        scope: event.scope,
        level: 'allow-once' as PermissionLevel,
        grantedBy: approvalOpts.approver || 'test-simulator',
        timestamp: new Date(),
        reason: approvalOpts.comment,
      } as PermissionGrantedEventData);
    } else {
      const denialOpts = options as DenialSimulationOptions;
      // Emit permission:denied event
      this.orchestrator.emit('permission:denied', {
        requestId: event.requestId,
        tool: event.tool,
        scope: event.scope,
        deniedBy: denialOpts.denier || 'test-simulator',
        timestamp: new Date(),
        reason: denialOpts.reason || 'Denied by test simulator',
      } as PermissionDeniedEventData);
    }
  }

  /**
   * Execute a dangerous operation response.
   */
  private async executeDangerousOperationResponse(
    request: CapturedRequest,
    action: 'approve' | 'deny',
    options: ApprovalSimulationOptions | DenialSimulationOptions
  ): Promise<void> {
    const event = request.data as DangerousOperationDetectedEventData;

    if (action === 'approve') {
      const approvalOpts = options as ApprovalSimulationOptions;
      // Emit dangerous:confirmed event
      this.orchestrator.emit('dangerous:confirmed', {
        operationId: event.operationId,
        tool: event.tool,
        operation: event.operation,
        confirmedBy: approvalOpts.approver || 'test-simulator',
        timestamp: new Date(),
        reason: approvalOpts.comment,
      } as DangerousOperationConfirmedEventData);
    } else {
      const denialOpts = options as DenialSimulationOptions;
      // Emit dangerous:blocked event
      this.orchestrator.emit('dangerous:blocked', {
        operationId: event.operationId,
        tool: event.tool,
        operation: event.operation,
        blockedBy: denialOpts.denier || 'test-simulator',
        timestamp: new Date(),
        reason: denialOpts.reason || 'Blocked by test simulator',
      } as DangerousOperationBlockedEventData);
    }
  }

  /**
   * Execute a timeout action.
   */
  private async executeTimeoutAction(
    request: CapturedRequest,
    options: TimeoutSimulationOptions
  ): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        this.activeTimeouts.delete(request.requestId);

        // Execute the timeout action based on configuration
        switch (options.timeoutAction) {
          case 'approve':
            await this.executeResponse(
              {
                id: this.generateResponseId(),
                type: request.type,
                action: 'approve',
                options: { approver: 'timeout-auto-approve' },
                consumed: true,
              },
              request
            );
            break;
          case 'escalate':
            // For escalation, emit a custom event that tests can listen for
            this.orchestrator.emit('apex-event', {
              type: 'confirmation:escalated',
              taskId: request.type === 'approval' ? (request.data as ApprovalRequiredEventData).taskId : undefined,
              timestamp: new Date(),
              data: {
                requestId: request.requestId,
                requestType: request.type,
                message: options.message || 'Escalated due to timeout',
              },
            });
            break;
          case 'reject':
          default:
            await this.executeResponse(
              {
                id: this.generateResponseId(),
                type: request.type,
                action: 'deny',
                options: { reason: options.message || 'Timeout - no response received' },
                consumed: true,
              },
              request
            );
            break;
        }

        resolve();
      }, options.timeoutMs);

      this.activeTimeouts.set(request.requestId, timeout);
    });
  }

  /**
   * Capture a request for async handling.
   */
  private captureRequest(request: CapturedRequest): void {
    // Check if any pending resolvers are waiting for this type
    for (const [key, resolver] of this.pendingRequestResolvers.entries()) {
      if (key.startsWith(request.type)) {
        resolver(request);
        return; // Request was handled by a resolver
      }
    }

    // No resolver waiting, add to captured requests
    this.capturedRequests.push(request);
  }

  /**
   * Generate a unique response ID.
   */
  private generateResponseId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay for specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ConfirmationSimulator for the given orchestrator.
 *
 * @param orchestrator The ApexOrchestrator instance
 * @returns A new ConfirmationSimulator instance
 *
 * @example
 * ```typescript
 * const simulator = createConfirmationSimulator(orchestrator);
 * simulator.simulateUserApproval('approval-123');
 * ```
 */
export function createConfirmationSimulator(
  orchestrator: ApexOrchestrator
): ConfirmationSimulator {
  return new ConfirmationSimulator(orchestrator);
}

/**
 * Create a ConfirmationSimulator with pre-configured responses.
 *
 * @param orchestrator The ApexOrchestrator instance
 * @param responses Initial batch responses to configure
 * @returns A configured ConfirmationSimulator instance
 *
 * @example
 * ```typescript
 * const simulator = createConfirmationSimulatorWithResponses(orchestrator, [
 *   { type: 'approval', action: 'approve' },
 *   { type: 'permission', matchPattern: 'Bash', action: 'deny' }
 * ]);
 * ```
 */
export function createConfirmationSimulatorWithResponses(
  orchestrator: ApexOrchestrator,
  responses: BatchResponseConfig[]
): ConfirmationSimulator {
  const simulator = new ConfirmationSimulator(orchestrator);
  simulator.simulateBatchResponses(responses);
  return simulator;
}

// ============================================================================
// Utility Functions (Standalone)
// ============================================================================

/**
 * Create a mock approval response object.
 *
 * This is useful for creating response objects directly without using
 * the full ConfirmationSimulator class.
 *
 * @param approvalId The approval ID to respond to
 * @param taskId The task ID
 * @param options Additional options
 * @returns A complete ApprovalResponse object
 */
export function createMockApprovalResponse(
  approvalId: string,
  taskId: string,
  options: {
    action?: 'approve' | 'deny';
    approver?: string;
    message?: string;
    gateName?: string;
  } = {}
): ApprovalResponse {
  const action = options.action || 'approve';
  const now = new Date();

  return {
    requestId: approvalId,
    taskId,
    response: action === 'approve' ? 'approved' : 'denied',
    approver: options.approver || 'test-simulator',
    message: options.message,
    approvalId,
    gateName: options.gateName || 'test-gate',
    action,
    timestamp: now,
    requestedAt: now,
    resolved: true,
  };
}

/**
 * Wait for a specific event on the orchestrator.
 *
 * @param orchestrator The orchestrator to listen on
 * @param eventName The event name to wait for
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that resolves with the event data
 */
export function waitForOrchestratorEvent<K extends keyof OrchestratorEvents>(
  orchestrator: ApexOrchestrator,
  eventName: K,
  timeoutMs: number = 30000
): Promise<Parameters<OrchestratorEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      orchestrator.off(eventName, handler);
      reject(new Error(`Timeout waiting for event '${eventName}' after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = ((...args: Parameters<OrchestratorEvents[K]>) => {
      clearTimeout(timeout);
      orchestrator.off(eventName, handler);
      resolve(args[0] as Parameters<OrchestratorEvents[K]>[0]);
    }) as OrchestratorEvents[K];

    orchestrator.on(eventName, handler);
  });
}
