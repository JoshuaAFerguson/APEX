import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGate as ApprovalGateConfig,
  ApprovalState,
  ApprovalStatus,
  generateApprovalId,
} from '@apexcli/core';
import { TaskStore } from './store';

/**
 * Events emitted by ApprovalGateController
 */
export interface ApprovalGateEvents {
  'approval:requested': (state: ApprovalState) => void;
  'approval:resolved': (state: ApprovalState, decision: 'approved' | 'denied' | 'timeout') => void;
  'approval:timeout': (state: ApprovalState) => void;
}

/**
 * Options for creating an ApprovalGateController
 */
export interface ApprovalGateOptions {
  /** The gate configuration */
  config: ApprovalGateConfig;
  /** Task ID this approval is for */
  taskId: string;
  /** Current stage name */
  stage: string;
  /** Agent handling this stage */
  agent: string;
  /** Store for persistence */
  store: TaskStore;
  /** Optional parent emitter to forward events to */
  parentEmitter?: EventEmitter;
  /** Optional context data */
  context?: Record<string, unknown>;
}

/**
 * Result of an approval request
 */
export interface ApprovalResult {
  status: 'approved' | 'denied' | 'timeout';
  approver?: string;
  comment?: string;
  respondedAt?: Date;
  approvalsReceived: number;
  approvalsRequired: number;
}

/**
 * Controller for managing the lifecycle of a single approval gate.
 * Handles approval requests, timeouts, and state persistence.
 */
export class ApprovalGateController extends EventEmitter<ApprovalGateEvents> {
  private state: ApprovalState;
  private config: ApprovalGateConfig;
  private store: TaskStore;
  private parentEmitter?: EventEmitter;
  private timeoutHandle?: NodeJS.Timeout;
  private resolveWait?: (result: ApprovalResult) => void;
  private rejectWait?: (error: Error) => void;
  private waitingPromise?: Promise<ApprovalResult>;

  constructor(options: ApprovalGateOptions) {
    super();

    this.config = options.config;
    this.store = options.store;
    this.parentEmitter = options.parentEmitter;

    // Create initial approval state
    this.state = {
      id: this.config.id || generateApprovalId(),
      taskId: options.taskId,
      gateName: this.config.name || `${this.config.type}-gate`,
      status: 'pending',
      approvalsRequired: this.config.minApprovals || 1,
      approvalsReceived: 0,
      requestedAt: new Date(),
      stage: options.stage,
      agent: options.agent,
      context: options.context,
      timeoutMinutes: this.config.timeout,
      expiresAt: this.config.timeout
        ? new Date(Date.now() + this.config.timeout * 60 * 1000)
        : undefined,
    };

    // Forward events to parent emitter if provided
    if (this.parentEmitter) {
      this.on('approval:requested', (state) => {
        this.parentEmitter!.emit('approval:requested', state);
      });
      this.on('approval:resolved', (state, decision) => {
        this.parentEmitter!.emit('approval:resolved', state, decision);
      });
      this.on('approval:timeout', (state) => {
        this.parentEmitter!.emit('approval:timeout', state);
      });
    }
  }

  /**
   * Get the current approval state
   */
  get approvalState(): ApprovalState {
    return { ...this.state };
  }

  /**
   * Get the approval ID
   */
  get id(): string {
    return this.state.id;
  }

  /**
   * Check if approval is still pending
   */
  get isPending(): boolean {
    return this.state.status === 'pending';
  }

  /**
   * Check if approval has been resolved
   */
  get isResolved(): boolean {
    return this.state.status !== 'pending';
  }

  /**
   * Request approval and wait for resolution.
   * This method can only be called once per instance.
   *
   * @returns Promise that resolves when approval is granted, denied, or times out
   * @throws Error if approval is already requested or resolved
   */
  async requestApproval(): Promise<ApprovalResult> {
    if (this.isResolved) {
      throw new Error('Approval gate is already resolved');
    }

    if (this.waitingPromise) {
      throw new Error('Approval already requested for this gate');
    }

    // Check for auto-approval
    if (this.config.autoApprove) {
      return this._resolveWithResult('approved', 'system', 'Auto-approved by configuration');
    }

    // Save initial state to store
    await this.store.saveApprovalState(this.state);

    // Emit approval:requested event
    this.emit('approval:requested', { ...this.state });

    // Set up timeout if configured
    if (this.config.timeout) {
      this.timeoutHandle = setTimeout(() => {
        this._handleTimeout();
      }, this.config.timeout * 60 * 1000);
    }

    // Create and return promise that resolves when approval is received
    this.waitingPromise = new Promise<ApprovalResult>((resolve, reject) => {
      this.resolveWait = resolve;
      this.rejectWait = reject;
    });

    return this.waitingPromise;
  }

  /**
   * Grant the approval
   *
   * @param approver Who granted the approval
   * @param comment Optional comment
   * @throws Error if approval is not pending or already has enough approvals
   */
  async grant(approver: string, comment?: string): Promise<void> {
    if (!this.isPending) {
      throw new Error('Cannot grant approval - gate is not pending');
    }

    if ((this.state.approvalsReceived || 0) >= (this.state.approvalsRequired || 1)) {
      throw new Error('Approval gate already has sufficient approvals');
    }

    // Update state
    this.state.approvalsReceived = (this.state.approvalsReceived || 0) + 1;
    this.state.respondedAt = new Date();
    this.state.approver = approver;
    this.state.comment = comment;

    // Check if we have enough approvals
    if ((this.state.approvalsReceived || 0) >= (this.state.approvalsRequired || 1)) {
      this.state.status = 'approved';
      await this._resolveApproval('approved', approver, comment);
    } else {
      // Still need more approvals, just save state
      await this.store.updateApprovalState(this.state.id, this.state);
    }
  }

  /**
   * Deny the approval
   *
   * @param approver Who denied the approval
   * @param reason Reason for denial
   * @throws Error if approval is not pending
   */
  async deny(approver: string, reason: string): Promise<void> {
    if (!this.isPending) {
      throw new Error('Cannot deny approval - gate is not pending');
    }

    // Update state
    this.state.status = 'denied';
    this.state.respondedAt = new Date();
    this.state.approver = approver;
    this.state.comment = reason;

    await this._resolveApproval('denied', approver, reason);
  }

  /**
   * Cancel the pending approval (e.g., if task is cancelled)
   */
  async cancel(): Promise<void> {
    if (!this.isPending) {
      return; // Already resolved
    }

    this.state.status = 'denied';
    this.state.respondedAt = new Date();
    this.state.comment = 'Cancelled';

    await this.store.updateApprovalState(this.state.id, this.state);
    this._cleanup();

    if (this.rejectWait) {
      this.rejectWait(new Error('Approval was cancelled'));
      this.resolveWait = undefined;
      this.rejectWait = undefined;
    }
  }

  /**
   * Clean up resources (timers, etc.)
   */
  dispose(): void {
    this._cleanup();
    this.removeAllListeners();
  }

  /**
   * Handle timeout when approval expires
   */
  private async _handleTimeout(): Promise<void> {
    if (!this.isPending) {
      return; // Already resolved
    }

    // Emit timeout event
    this.emit('approval:timeout', { ...this.state });

    if (this.config.autoApproveOnTimeout) {
      // Auto-approve on timeout
      this.state.status = 'approved';
      this.state.approvalsReceived = this.state.approvalsRequired || 1;
      this.state.respondedAt = new Date();
      this.state.approver = 'system';
      this.state.comment = 'Auto-approved due to timeout';

      await this._resolveApproval('timeout', 'system', 'Auto-approved due to timeout');
    } else {
      // Auto-deny on timeout (default behavior)
      this.state.status = 'denied';
      this.state.respondedAt = new Date();
      this.state.approver = 'system';
      this.state.comment = 'Approval timed out';

      await this._resolveApproval('timeout', 'system', 'Approval timed out');
    }
  }

  /**
   * Resolve the approval and clean up
   */
  private async _resolveApproval(decision: 'approved' | 'denied' | 'timeout', approver?: string, comment?: string): Promise<void> {
    // Save final state
    await this.store.updateApprovalState(this.state.id, this.state);

    // Clean up timeout
    this._cleanup();

    // Emit resolved event
    this.emit('approval:resolved', { ...this.state }, decision);

    // Resolve waiting promise
    if (this.resolveWait) {
      const result: ApprovalResult = {
        status: decision === 'timeout'
          ? (this.config.autoApproveOnTimeout ? 'approved' : 'denied')
          : decision,
        approver,
        comment,
        respondedAt: this.state.respondedAt,
        approvalsReceived: this.state.approvalsReceived || 0,
        approvalsRequired: this.state.approvalsRequired || 1,
      };

      this.resolveWait(result);
      this.resolveWait = undefined;
      this.rejectWait = undefined;
    }
  }

  /**
   * Helper to resolve with a result (for auto-approval)
   */
  private async _resolveWithResult(status: 'approved' | 'denied', approver?: string, comment?: string): Promise<ApprovalResult> {
    this.state.status = status === 'approved' ? 'approved' : 'denied';
    this.state.respondedAt = new Date();

    if (status === 'approved') {
      this.state.approvalsReceived = this.state.approvalsRequired || 1;
      this.state.approver = approver || 'system';
      this.state.comment = comment;
    } else {
      this.state.approver = approver;
      this.state.comment = comment;
    }

    await this.store.saveApprovalState(this.state);

    return {
      status,
      approver,
      comment,
      respondedAt: this.state.respondedAt,
      approvalsReceived: this.state.approvalsReceived || 0,
      approvalsRequired: this.state.approvalsRequired || 1,
    };
  }

  /**
   * Clean up timeout and internal state
   */
  private _cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }
}