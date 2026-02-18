import { EventEmitter } from 'eventemitter3';
import {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  PermissionNotification,
  PermissionLevel
} from '../../types';

/**
 * Mock permission trigger for simulating permission events in tests
 * Allows controlled triggering of permission-related scenarios
 */
export class MockPermissionTrigger extends EventEmitter {
  private requestCounter = 0;

  /**
   * Simulate a permission request
   */
  triggerPermissionRequest(options: {
    tool: string;
    agent: string;
    scope?: string;
    description?: string;
    isDangerous?: boolean;
    metadata?: Record<string, unknown>;
  }): string {
    const requestId = `test-permission-${++this.requestCounter}-${Date.now()}`;

    const eventData: PermissionRequestEventData = {
      requestId,
      tool: options.tool,
      scope: options.scope,
      description: options.description || `Request to use ${options.tool}`,
      isDangerous: options.isDangerous || false,
      agent: options.agent,
      timestamp: new Date(),
      metadata: options.metadata
    };

    this.emit('permission:request', eventData);
    return requestId;
  }

  /**
   * Simulate granting permission
   */
  triggerPermissionGranted(options: {
    requestId: string;
    tool: string;
    scope?: string;
    level?: PermissionLevel;
    grantedBy?: string;
    reason?: string;
  }): void {
    const eventData: PermissionGrantedEventData = {
      requestId: options.requestId,
      tool: options.tool,
      scope: options.scope,
      level: options.level || 'allow',
      grantedBy: options.grantedBy || 'test-user',
      timestamp: new Date(),
      reason: options.reason
    };

    this.emit('permission:granted', eventData);
  }

  /**
   * Simulate denying permission
   */
  triggerPermissionDenied(options: {
    requestId: string;
    tool: string;
    scope?: string;
    deniedBy?: string;
    reason: string;
  }): void {
    const eventData: PermissionDeniedEventData = {
      requestId: options.requestId,
      tool: options.tool,
      scope: options.scope,
      deniedBy: options.deniedBy || 'test-user',
      timestamp: new Date(),
      reason: options.reason
    };

    this.emit('permission:denied', eventData);
  }

  /**
   * Simulate detecting a dangerous operation
   */
  triggerDangerousOperation(options: {
    tool: string;
    agent: string;
    operation: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    riskDescription?: string;
    context?: Record<string, unknown>;
  }): string {
    const operationId = `test-dangerous-${++this.requestCounter}-${Date.now()}`;

    const eventData: DangerousOperationDetectedEventData = {
      operationId,
      tool: options.tool,
      operation: options.operation,
      riskLevel: options.riskLevel || 'high',
      riskDescription: options.riskDescription || `Dangerous operation: ${options.operation}`,
      agent: options.agent,
      timestamp: new Date(),
      context: options.context
    };

    this.emit('dangerous:detected', eventData);
    return operationId;
  }

  /**
   * Simulate confirming a dangerous operation
   */
  triggerDangerousOperationConfirmed(options: {
    operationId: string;
    tool: string;
    operation: string;
    confirmedBy?: string;
    reason?: string;
  }): void {
    const eventData: DangerousOperationConfirmedEventData = {
      operationId: options.operationId,
      tool: options.tool,
      operation: options.operation,
      confirmedBy: options.confirmedBy || 'test-user',
      timestamp: new Date(),
      reason: options.reason
    };

    this.emit('dangerous:confirmed', eventData);
  }

  /**
   * Simulate blocking a dangerous operation
   */
  triggerDangerousOperationBlocked(options: {
    operationId: string;
    tool: string;
    operation: string;
    blockedBy?: string;
    reason: string;
  }): void {
    const eventData: DangerousOperationBlockedEventData = {
      operationId: options.operationId,
      tool: options.tool,
      operation: options.operation,
      blockedBy: options.blockedBy || 'test-user',
      timestamp: new Date(),
      reason: options.reason
    };

    this.emit('dangerous:blocked', eventData);
  }

  /**
   * Simulate a permission notification
   */
  triggerPermissionNotification(options: {
    taskId: string;
    agent: string;
    tool: string;
    type: 'permission:requested' | 'permission:granted' | 'permission:denied' | 'dangerous:detected' | 'dangerous:confirmed' | 'dangerous:blocked';
    title: string;
    message: string;
    scope?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    requiresAction?: boolean;
    actions?: string[];
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): string {
    const notificationId = `test-notification-${++this.requestCounter}-${Date.now()}`;

    const notification: PermissionNotification = {
      id: notificationId,
      type: options.type,
      taskId: options.taskId,
      agent: options.agent,
      tool: options.tool,
      scope: options.scope,
      title: options.title,
      message: options.message,
      severity: options.severity || 'info',
      requiresAction: options.requiresAction || false,
      actions: options.actions || [],
      metadata: options.metadata,
      timestamp: new Date(),
      expiresAt: options.expiresAt,
      acknowledged: false
    };

    this.emit('permission:notification', notification);
    return notificationId;
  }

  /**
   * Create a complete permission request flow
   */
  async simulatePermissionFlow(options: {
    tool: string;
    agent: string;
    taskId: string;
    approve: boolean;
    scope?: string;
    isDangerous?: boolean;
    delay?: number;
  }): Promise<{
    requestId: string;
    notificationId: string;
    result: 'approved' | 'denied';
  }> {
    const delay = options.delay || 100;

    // 1. Trigger permission request
    const requestId = this.triggerPermissionRequest({
      tool: options.tool,
      agent: options.agent,
      scope: options.scope,
      isDangerous: options.isDangerous
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, delay));

    // 2. Trigger notification
    const notificationId = this.triggerPermissionNotification({
      taskId: options.taskId,
      agent: options.agent,
      tool: options.tool,
      type: 'permission:requested',
      title: `Permission Request: ${options.tool}`,
      message: `Agent ${options.agent} requests permission to use ${options.tool}`,
      scope: options.scope,
      requiresAction: true,
      actions: ['approve', 'deny']
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Approve or deny
    if (options.approve) {
      this.triggerPermissionGranted({
        requestId,
        tool: options.tool,
        scope: options.scope,
        level: 'allow'
      });

      // Trigger success notification
      this.triggerPermissionNotification({
        taskId: options.taskId,
        agent: options.agent,
        tool: options.tool,
        type: 'permission:granted',
        title: `Permission Granted: ${options.tool}`,
        message: `Agent ${options.agent} has been granted permission to use ${options.tool}`,
        scope: options.scope,
        severity: 'info'
      });

      return { requestId, notificationId, result: 'approved' };
    } else {
      this.triggerPermissionDenied({
        requestId,
        tool: options.tool,
        scope: options.scope,
        reason: 'User denied permission'
      });

      // Trigger denial notification
      this.triggerPermissionNotification({
        taskId: options.taskId,
        agent: options.agent,
        tool: options.tool,
        type: 'permission:denied',
        title: `Permission Denied: ${options.tool}`,
        message: `Permission denied for agent ${options.agent} to use ${options.tool}`,
        scope: options.scope,
        severity: 'warning'
      });

      return { requestId, notificationId, result: 'denied' };
    }
  }

  /**
   * Simulate a dangerous operation flow
   */
  async simulateDangerousOperationFlow(options: {
    tool: string;
    agent: string;
    taskId: string;
    operation: string;
    confirm: boolean;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    delay?: number;
  }): Promise<{
    operationId: string;
    notificationId: string;
    result: 'confirmed' | 'blocked';
  }> {
    const delay = options.delay || 100;

    // 1. Detect dangerous operation
    const operationId = this.triggerDangerousOperation({
      tool: options.tool,
      agent: options.agent,
      operation: options.operation,
      riskLevel: options.riskLevel || 'high'
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, delay));

    // 2. Trigger notification
    const notificationId = this.triggerPermissionNotification({
      taskId: options.taskId,
      agent: options.agent,
      tool: options.tool,
      type: 'dangerous:detected',
      title: `Dangerous Operation Detected: ${options.tool}`,
      message: `Agent ${options.agent} is attempting a dangerous operation: ${options.operation}`,
      severity: 'error',
      requiresAction: true,
      actions: ['confirm', 'block']
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Confirm or block
    if (options.confirm) {
      this.triggerDangerousOperationConfirmed({
        operationId,
        tool: options.tool,
        operation: options.operation
      });

      return { operationId, notificationId, result: 'confirmed' };
    } else {
      this.triggerDangerousOperationBlocked({
        operationId,
        tool: options.tool,
        operation: options.operation,
        reason: 'User blocked dangerous operation'
      });

      return { operationId, notificationId, result: 'blocked' };
    }
  }

  /**
   * Reset the trigger counter
   */
  reset(): void {
    this.requestCounter = 0;
    this.removeAllListeners();
  }
}