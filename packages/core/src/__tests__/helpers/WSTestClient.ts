import { WebSocket } from 'ws';
import { EventEmitter } from 'eventemitter3';
import { PermissionNotification } from '../../types';

/**
 * WebSocket test client for testing real-time permission notifications
 * Connects to the APEX API WebSocket endpoint and captures events
 */
export class WSTestClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private receivedMessages: Array<{ type: string; data: unknown; timestamp: Date }> = [];

  constructor(url: string) {
    super();
    this.url = url;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          clearTimeout(timeoutId);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            const event = {
              type: message.type || 'unknown',
              data: message.data || message,
              timestamp: new Date()
            };

            this.receivedMessages.push(event);
            this.emit('message', event);

            // Emit specific event types
            if (message.type) {
              this.emit(message.type, message.data || message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.emit('parse-error', { data: data.toString(), error });
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeoutId);
          this.emit('error', error);
          if (!this.connected) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          this.connected = false;
          this.ws = null;
          this.emit('disconnected', { code, reason: reason.toString() });

          // Auto-reconnect logic
          if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
              this.connect().catch(console.error);
            }, 1000 * this.reconnectAttempts);
          }
        });

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.connected = false;
      this.maxReconnectAttempts = 0; // Prevent auto-reconnect
      this.ws.close(1000, 'Client requested disconnect');
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  send(message: unknown): void {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(messageStr);
  }

  /**
   * Wait for a specific message type
   */
  async waitForMessage(type: string, timeout = 5000): Promise<{ type: string; data: unknown; timestamp: Date }> {
    return new Promise((resolve, reject) => {
      // Check if message already received
      const existingMessage = this.getLatestMessage(type);
      if (existingMessage) {
        resolve(existingMessage);
        return;
      }

      const timeoutId = setTimeout(() => {
        this.off(type, handler);
        reject(new Error(`Timeout waiting for message: ${type}`));
      }, timeout);

      const handler = (data: unknown) => {
        clearTimeout(timeoutId);
        this.off(type, handler);
        const message = { type, data, timestamp: new Date() };
        resolve(message);
      };

      this.on(type, handler);
    });
  }

  /**
   * Get all received messages
   */
  getMessages(): Array<{ type: string; data: unknown; timestamp: Date }> {
    return [...this.receivedMessages];
  }

  /**
   * Get messages of a specific type
   */
  getMessagesByType(type: string): Array<{ type: string; data: unknown; timestamp: Date }> {
    return this.receivedMessages.filter(msg => msg.type === type);
  }

  /**
   * Get the most recent message of a specific type
   */
  getLatestMessage(type: string): { type: string; data: unknown; timestamp: Date } | undefined {
    const messages = this.getMessagesByType(type);
    return messages[messages.length - 1];
  }

  /**
   * Get permission notification messages
   */
  getPermissionNotifications(): PermissionNotification[] {
    return this.getMessagesByType('permission:notification')
      .map(msg => msg.data as PermissionNotification);
  }

  /**
   * Clear all received messages
   */
  clearMessages(): void {
    this.receivedMessages = [];
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to specific events (sends subscription message if supported)
   */
  subscribe(events: string[]): void {
    if (!this.isConnected()) {
      throw new Error('Cannot subscribe - WebSocket not connected');
    }

    this.send({
      type: 'subscribe',
      events
    });
  }

  /**
   * Verify that a permission notification was received with expected properties
   */
  hasReceivedNotification(matcher: Partial<PermissionNotification>): boolean {
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
   * Get the count of messages by type
   */
  getMessageCount(type?: string): number {
    if (type) {
      return this.getMessagesByType(type).length;
    }
    return this.receivedMessages.length;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.receivedMessages = [];
  }
}