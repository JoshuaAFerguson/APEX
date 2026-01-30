/**
 * PermissionRevocationController - Test helper for coordinating mid-stream permission revocations
 *
 * This controller enables deterministic testing of permission revocation during active
 * Claude SDK streaming sessions. It schedules revocations to occur at precise moments
 * in the event stream, and tracks an audit trail for test assertions.
 *
 * Usage:
 *   const controller = new PermissionRevocationController(permissionManager);
 *   controller.scheduleRevocation('Write', 2);  // Revoke after 2nd event
 *   // ... run streaming session, calling notifyEventProcessed() per event
 *   expect(controller.getRevocationLog()).toHaveLength(1);
 */

import { PermissionManager } from '../../permission-manager';

/**
 * Record of a permission revocation that was executed
 */
export interface RevocationLogEntry {
  /** The tool whose permission was revoked */
  tool: string;
  /** Optional scope of the revoked permission */
  scope?: string;
  /** When the revocation was executed */
  timestamp: Date;
  /** The stream event index that triggered this revocation */
  eventIndex: number;
  /** Whether the revocation actually removed an existing permission */
  wasRevoked: boolean;
}

/**
 * Configuration for a scheduled permission revocation
 */
export interface RevocationSchedule {
  /** The tool to revoke permission for */
  tool: string;
  /** Optional scope for the revocation */
  scope?: string;
  /** Execute the revocation after this many events have been processed */
  afterEventIndex: number;
  /** Optional: also grant a 'deny' permission after revocation (default: false) */
  setDeny?: boolean;
}

/**
 * Summary of all revocations executed during a test
 */
export interface RevocationSummary {
  /** Total number of revocations executed */
  totalRevocations: number;
  /** Number that actually removed existing permissions */
  successfulRevocations: number;
  /** Number that found no permission to revoke */
  noopRevocations: number;
  /** Tools that were revoked */
  revokedTools: string[];
  /** The event index of the first revocation */
  firstRevocationAt: number | null;
  /** The event index of the last revocation */
  lastRevocationAt: number | null;
}

/**
 * Coordinates permission revocation timing during streaming SDK sessions.
 *
 * The controller works by:
 * 1. Accepting revocation schedules (tool + event index)
 * 2. Being notified as each stream event is processed
 * 3. Executing revocations when the event count matches a schedule
 * 4. Recording an audit trail for test assertions
 */
export class PermissionRevocationController {
  private schedules: RevocationSchedule[] = [];
  private log: RevocationLogEntry[] = [];
  private eventCount = 0;
  private manager: PermissionManager;
  private onRevocationCallbacks: Array<(entry: RevocationLogEntry) => void> = [];

  constructor(manager: PermissionManager) {
    this.manager = manager;
  }

  /**
   * Schedule a permission revocation to occur after N stream events are processed.
   *
   * @param tool - The tool name whose permission should be revoked
   * @param afterEventIndex - Execute revocation after this many events (1-indexed)
   * @param scope - Optional scope for the revocation
   * @returns this for chaining
   */
  scheduleRevocation(tool: string, afterEventIndex: number, scope?: string): this {
    this.schedules.push({ tool, scope, afterEventIndex });
    return this;
  }

  /**
   * Schedule a permission revocation that also sets an explicit 'deny' permission.
   * This is stronger than just revoking — it actively blocks future access.
   *
   * @param tool - The tool name to deny
   * @param afterEventIndex - Execute after this many events (1-indexed)
   * @param scope - Optional scope for the denial
   * @returns this for chaining
   */
  scheduleDenial(tool: string, afterEventIndex: number, scope?: string): this {
    this.schedules.push({ tool, scope, afterEventIndex, setDeny: true });
    return this;
  }

  /**
   * Register a callback to be invoked when a revocation is executed.
   * Useful for coordinating additional test actions.
   *
   * @param callback - Function called with the revocation log entry
   * @returns this for chaining
   */
  onRevocation(callback: (entry: RevocationLogEntry) => void): this {
    this.onRevocationCallbacks.push(callback);
    return this;
  }

  /**
   * Notify the controller that a stream event has been processed.
   * This should be called from test hooks or mock handlers after each
   * streaming event is yielded by the mock SDK.
   *
   * If the current event count matches any scheduled revocation,
   * the revocation is executed immediately.
   */
  async notifyEventProcessed(): Promise<void> {
    this.eventCount++;

    const pendingRevocations = this.schedules.filter(
      s => s.afterEventIndex === this.eventCount
    );

    for (const schedule of pendingRevocations) {
      // First revoke the existing permission
      const wasRevoked = await this.manager.revokePermission(
        schedule.tool,
        schedule.scope
      );

      // Optionally set an explicit deny
      if (schedule.setDeny) {
        await this.manager.grantPermission(
          schedule.tool,
          schedule.scope,
          'deny'
        );
      }

      const entry: RevocationLogEntry = {
        tool: schedule.tool,
        scope: schedule.scope,
        timestamp: new Date(),
        eventIndex: this.eventCount,
        wasRevoked,
      };

      this.log.push(entry);

      // Notify callbacks
      for (const cb of this.onRevocationCallbacks) {
        cb(entry);
      }
    }
  }

  /**
   * Get the current stream event count
   */
  getEventCount(): number {
    return this.eventCount;
  }

  /**
   * Get the full revocation audit trail
   */
  getRevocationLog(): RevocationLogEntry[] {
    return [...this.log];
  }

  /**
   * Get a summary of all revocations executed
   */
  getSummary(): RevocationSummary {
    const successfulRevocations = this.log.filter(e => e.wasRevoked).length;
    const revokedTools = [...new Set(this.log.map(e => e.tool))];

    return {
      totalRevocations: this.log.length,
      successfulRevocations,
      noopRevocations: this.log.length - successfulRevocations,
      revokedTools,
      firstRevocationAt: this.log.length > 0 ? this.log[0].eventIndex : null,
      lastRevocationAt: this.log.length > 0 ? this.log[this.log.length - 1].eventIndex : null,
    };
  }

  /**
   * Check if a specific tool has been revoked at any point
   */
  wasToolRevoked(tool: string): boolean {
    return this.log.some(e => e.tool === tool && e.wasRevoked);
  }

  /**
   * Reset all state for re-use between tests
   */
  reset(): void {
    this.schedules = [];
    this.log = [];
    this.eventCount = 0;
    this.onRevocationCallbacks = [];
  }
}
