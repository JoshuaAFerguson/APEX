/**
 * Browser-compatible exponential backoff reconnector
 * Simplified version for WebSocket reconnection in browser environments
 */

/**
 * Jitter strategy for exponential backoff
 */
export type JitterStrategy = 'none' | 'full' | 'equal' | 'decorrelated';

/**
 * Reconnection state
 */
export type ReconnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * Configuration for exponential backoff reconnection
 */
export interface ExponentialBackoffConfig {
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Backoff factor (multiplier for each retry) */
  backoffFactor: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Jitter strategy to prevent thundering herd */
  jitterStrategy: JitterStrategy;
}

/**
 * Default configuration for exponential backoff
 */
export const DEFAULT_EXPONENTIAL_BACKOFF_CONFIG: ExponentialBackoffConfig = {
  baseDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30000,
  maxRetries: 3,
  jitterStrategy: 'equal',
};

/**
 * Statistics for reconnection attempts
 */
export interface ReconnectionStats {
  currentAttempt: number;
  totalReconnections: number;
  lastDelayMs: number;
  state: ReconnectionState;
  lastError?: string;
  lastAttemptTime?: Date;
  lastSuccessTime?: Date;
}

type EventHandler<T extends unknown[]> = (...args: T) => void;

/**
 * Exponential backoff reconnection manager for browser environments
 */
export class ExponentialBackoffReconnector {
  private config: ExponentialBackoffConfig;
  private stats: ReconnectionStats;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private lastDelayMs: number = 0;

  // Event handlers
  private handlers: Map<string, Set<EventHandler<any>>> = new Map();

  constructor(config: Partial<ExponentialBackoffConfig> = {}) {
    this.config = { ...DEFAULT_EXPONENTIAL_BACKOFF_CONFIG, ...config };
    this.stats = {
      currentAttempt: 0,
      totalReconnections: 0,
      lastDelayMs: 0,
      state: 'idle',
    };
  }

  /**
   * Add event listener
   */
  on<T extends unknown[]>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  off<T extends unknown[]>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    }
  }

  /**
   * Calculate delay for a given attempt number
   */
  calculateDelay(attempt: number): number {
    if (attempt <= 0) {
      throw new Error('Attempt number must be positive');
    }

    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffFactor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    const delayWithJitter = this.applyJitter(cappedDelay);

    return Math.max(0, delayWithJitter);
  }

  private applyJitter(delay: number): number {
    switch (this.config.jitterStrategy) {
      case 'none':
        return delay;
      case 'full':
        return Math.random() * delay;
      case 'equal':
        return delay * 0.5 + Math.random() * delay * 0.5;
      case 'decorrelated':
        const min = this.config.baseDelayMs;
        const max = Math.min(delay * 3, this.config.maxDelayMs);
        return min + Math.random() * (max - min);
      default:
        return delay;
    }
  }

  private setState(newState: ReconnectionState): void {
    const previousState = this.stats.state;
    if (previousState !== newState) {
      this.stats.state = newState;
      this.emit('state:changed', previousState, newState);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect(connectFn: () => Promise<void>): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.stats.currentAttempt >= this.config.maxRetries) {
      this.setState('failed');
      this.emit('reconnect:exhausted', this.stats.currentAttempt, this.stats.lastError || 'Max retries exceeded');
      return;
    }

    this.stats.currentAttempt++;
    this.stats.lastAttemptTime = new Date();

    const delayMs = this.calculateDelay(this.stats.currentAttempt);
    this.stats.lastDelayMs = delayMs;
    this.lastDelayMs = delayMs;

    this.setState('reconnecting');
    this.emit('reconnect:attempt', this.stats.currentAttempt, delayMs);

    this.reconnectTimer = setTimeout(async () => {
      this.setState('connecting');

      try {
        await connectFn();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.notifyConnectionFailed(errorMessage);
      }
    }, delayMs);
  }

  /**
   * Notify that a disconnection has occurred
   */
  notifyDisconnected(error?: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (error) {
      this.stats.lastError = error;
    }

    this.stats.currentAttempt = 0;
    this.setState('idle');
  }

  /**
   * Notify that a connection has been successfully established
   */
  notifyConnected(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    const totalTime = this.stats.lastAttemptTime
      ? Date.now() - this.stats.lastAttemptTime.getTime()
      : 0;

    this.stats.lastSuccessTime = new Date();
    this.stats.totalReconnections += this.stats.currentAttempt > 0 ? 1 : 0;

    if (this.stats.currentAttempt > 0) {
      this.emit('reconnect:success', this.stats.currentAttempt, totalTime);
    }

    this.stats.currentAttempt = 0;
    this.stats.lastError = undefined;
    this.setState('connected');
  }

  /**
   * Notify that a connection attempt has failed
   */
  notifyConnectionFailed(error: string): void {
    this.stats.lastError = error;
    this.emit('reconnect:failure', this.stats.currentAttempt, error);

    if (this.stats.currentAttempt < this.config.maxRetries) {
      this.setState('idle');
    } else {
      this.setState('failed');
      this.emit('reconnect:exhausted', this.stats.currentAttempt, error);
    }
  }

  /**
   * Reset the reconnector state
   */
  reset(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.stats = {
      currentAttempt: 0,
      totalReconnections: 0,
      lastDelayMs: 0,
      state: 'idle',
    };

    this.lastDelayMs = 0;
    this.setState('idle');
  }

  getStats(): ReconnectionStats {
    return { ...this.stats };
  }

  getConfig(): ExponentialBackoffConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ExponentialBackoffConfig>): void {
    this.config = { ...this.config, ...config };
    this.reset();
  }

  isReconnecting(): boolean {
    return this.stats.state === 'reconnecting' || this.stats.state === 'connecting';
  }

  isExhausted(): boolean {
    return this.stats.state === 'failed';
  }

  isConnected(): boolean {
    return this.stats.state === 'connected';
  }

  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.handlers.clear();
  }
}
