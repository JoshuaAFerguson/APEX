import { EventEmitter } from 'eventemitter3';
import { PermissionNotification } from '../../types';

/**
 * Event collector for capturing and analyzing permission notification events
 * Used in integration tests to verify event emission and content
 */
export class EventCollector {
  private events: Array<{ type: string; data: unknown; timestamp: Date }> = [];
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to all permission-related events
    const permissionEvents = [
      'permission:request',
      'permission:granted',
      'permission:denied',
      'permission:notification',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked'
    ];

    permissionEvents.forEach(eventType => {
      this.emitter.on(eventType, (data: unknown) => {
        this.events.push({
          type: eventType,
          data,
          timestamp: new Date()
        });
      });
    });
  }

  /**
   * Get all collected events
   */
  getEvents(): Array<{ type: string; data: unknown; timestamp: Date }> {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(type: string): Array<{ type: string; data: unknown; timestamp: Date }> {
    return this.events.filter(event => event.type === type);
  }

  /**
   * Get the most recent event of a specific type
   */
  getLatestEvent(type: string): { type: string; data: unknown; timestamp: Date } | undefined {
    const events = this.getEventsByType(type);
    return events[events.length - 1];
  }

  /**
   * Wait for a specific event to be emitted
   */
  async waitForEvent(type: string, timeout = 5000): Promise<{ type: string; data: unknown; timestamp: Date }> {
    return new Promise((resolve, reject) => {
      // Check if event already exists
      const existingEvent = this.getLatestEvent(type);
      if (existingEvent) {
        resolve(existingEvent);
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.emitter.off(type, handler);
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeout);

      // Set up event handler
      const handler = (data: unknown) => {
        clearTimeout(timeoutId);
        this.emitter.off(type, handler);
        const event = { type, data, timestamp: new Date() };
        resolve(event);
      };

      this.emitter.on(type, handler);
    });
  }

  /**
   * Clear all collected events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get permission notification events specifically
   */
  getPermissionNotifications(): PermissionNotification[] {
    return this.getEventsByType('permission:notification')
      .map(event => event.data as PermissionNotification);
  }

  /**
   * Verify that a permission notification was emitted with expected properties
   */
  hasPermissionNotification(matcher: Partial<PermissionNotification>): boolean {
    const notifications = this.getPermissionNotifications();

    return notifications.some(notification => {
      return Object.keys(matcher).every(key => {
        const expectedValue = (matcher as any)[key];
        const actualValue = (notification as any)[key];

        if (typeof expectedValue === 'object' && expectedValue !== null) {
          return JSON.stringify(actualValue) === JSON.stringify(expectedValue);
        }

        return actualValue === expectedValue;
      });
    });
  }

  /**
   * Get the count of events by type
   */
  getEventCount(type?: string): number {
    if (type) {
      return this.getEventsByType(type).length;
    }
    return this.events.length;
  }

  /**
   * Remove all event listeners (cleanup)
   */
  destroy(): void {
    this.emitter.removeAllListeners();
    this.events = [];
  }
}