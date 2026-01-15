import { EventEmitter } from 'events';

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
  /** Current attempt number (0 = not started) */
  currentAttempt: number;
  /** Total number of reconnections performed */
  totalReconnections: number;
  /** Last calculated delay in milliseconds */
  lastDelayMs: number;
  /** Current state */
  state: ReconnectionState;
  /** Last error encountered */
  lastError?: string;
  /** Timestamp of last connection attempt */
  lastAttemptTime?: Date;
  /** Timestamp of last successful connection */
  lastSuccessTime?: Date;
}

/**
 * Events emitted by ExponentialBackoffReconnector
 */
export interface ExponentialBackoffEvents {
  'state:changed': (previousState: ReconnectionState, newState: ReconnectionState) => void;
  'reconnect:attempt': (attempt: number, delayMs: number) => void;
  'reconnect:success': (attempt: number, totalTime: number) => void;
  'reconnect:failure': (attempt: number, error: string) => void;
  'reconnect:exhausted': (totalAttempts: number, lastError: string) => void;
}

/**
 * Exponential backoff reconnection manager
 *
 * Implements configurable exponential backoff with jitter for connection retry logic.
 * Provides state management and detailed events for monitoring reconnection behavior.
 *
 * @example
 * ```typescript
 * const reconnector = new ExponentialBackoffReconnector({
 *   baseDelayMs: 1000,
 *   backoffFactor: 2,
 *   maxDelayMs: 30000,
 *   maxRetries: 5,
 *   jitterStrategy: 'equal'
 * });
 *
 * reconnector.on('reconnect:attempt', (attempt, delay) => {
 *   console.log(`Attempting reconnection ${attempt} in ${delay}ms`);
 * });
 *
 * reconnector.on('state:changed', (prev, next) => {
 *   console.log(`State changed: ${prev} -> ${next}`);
 * });
 *
 * // When disconnection detected
 * await reconnector.notifyDisconnected('Connection lost');
 *
 * // In reconnection callback
 * try {
 *   await connectFunction();
 *   reconnector.notifyConnected();
 * } catch (error) {
 *   reconnector.notifyConnectionFailed(error.message);
 * }
 * ```
 */
export class ExponentialBackoffReconnector extends EventEmitter<ExponentialBackoffEvents> {
  private config: ExponentialBackoffConfig;
  private stats: ReconnectionStats;
  private reconnectTimer?: NodeJS.Timeout;
  private lastDelayMs: number = 0;

  constructor(config: Partial<ExponentialBackoffConfig> = {}) {
    super();
    this.config = { ...DEFAULT_EXPONENTIAL_BACKOFF_CONFIG, ...config };
    this.stats = {
      currentAttempt: 0,
      totalReconnections: 0,
      lastDelayMs: 0,
      state: 'idle',
    };
  }

  /**
   * Calculate delay for a given attempt number
   *
   * @param attempt - The attempt number (1-based)
   * @returns Delay in milliseconds with jitter applied
   */
  calculateDelay(attempt: number): number {
    if (attempt <= 0) {
      throw new Error('Attempt number must be positive');
    }

    // Calculate base exponential delay
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffFactor, attempt - 1);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Apply jitter based on strategy
    const delayWithJitter = this.applyJitter(cappedDelay, attempt);

    return Math.max(0, delayWithJitter);
  }

  /**
   * Apply jitter to delay based on configured strategy
   *
   * @param delay - Base delay in milliseconds
   * @param attempt - Current attempt number
   * @returns Delay with jitter applied
   */
  private applyJitter(delay: number, attempt: number): number {
    switch (this.config.jitterStrategy) {
      case 'none':
        return delay;

      case 'full':
        // Random delay between 0 and calculated delay
        return Math.random() * delay;

      case 'equal':
        // Half the delay plus random half
        return delay * 0.5 + Math.random() * delay * 0.5;

      case 'decorrelated':
        // Decorrelated jitter using previous delay
        const min = this.config.baseDelayMs;
        const max = Math.min(delay * 3, this.config.maxDelayMs);
        return min + Math.random() * (max - min);

      default:
        return delay;
    }
  }

  /**
   * Update the internal state and emit state change event
   *
   * @param newState - The new state
   */
  private setState(newState: ReconnectionState): void {
    const previousState = this.stats.state;
    if (previousState !== newState) {
      this.stats.state = newState;
      this.emit('state:changed', previousState, newState);
    }
  }

  /**
   * Schedule a reconnection attempt
   *
   * @param connectFn - Function to call for reconnection
   */
  scheduleReconnect(connectFn: () => Promise<void>): void {
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Check if we've exceeded max retries
    if (this.stats.currentAttempt >= this.config.maxRetries) {
      this.setState('failed');
      this.emit('reconnect:exhausted', this.stats.currentAttempt, this.stats.lastError || 'Max retries exceeded');
      return;
    }

    // Increment attempt counter
    this.stats.currentAttempt++;
    this.stats.lastAttemptTime = new Date();

    // Calculate delay
    const delayMs = this.calculateDelay(this.stats.currentAttempt);
    this.stats.lastDelayMs = delayMs;
    this.lastDelayMs = delayMs;

    // Update state and emit attempt event
    this.setState('reconnecting');
    this.emit('reconnect:attempt', this.stats.currentAttempt, delayMs);

    // Schedule the reconnection
    this.reconnectTimer = setTimeout(async () => {
      this.setState('connecting');

      try {
        await connectFn();
        // Note: connectFn should call notifyConnected() on success
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.notifyConnectionFailed(errorMessage);
      }
    }, delayMs);
  }

  /**
   * Notify that a disconnection has occurred
   *
   * @param error - Optional error message describing the disconnection
   */
  notifyDisconnected(error?: string): void {
    // Clear any pending reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Update stats
    if (error) {
      this.stats.lastError = error;
    }

    // Reset attempt counter for new disconnection cycle
    this.stats.currentAttempt = 0;

    // Update state (will be changed to 'reconnecting' when scheduleReconnect is called)
    this.setState('idle');
  }

  /**
   * Notify that a connection has been successfully established
   */
  notifyConnected(): void {
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Calculate total time if we had attempt start time
    const totalTime = this.stats.lastAttemptTime
      ? Date.now() - this.stats.lastAttemptTime.getTime()
      : 0;

    // Update stats
    this.stats.lastSuccessTime = new Date();
    this.stats.totalReconnections += this.stats.currentAttempt > 0 ? 1 : 0;

    // Emit success event before resetting attempts
    if (this.stats.currentAttempt > 0) {
      this.emit('reconnect:success', this.stats.currentAttempt, totalTime);
    }

    // Reset for next disconnection cycle
    this.stats.currentAttempt = 0;
    this.stats.lastError = undefined;

    // Update state
    this.setState('connected');
  }

  /**
   * Notify that a connection attempt has failed
   *
   * @param error - Error message describing the failure
   */
  notifyConnectionFailed(error: string): void {
    this.stats.lastError = error;
    this.emit('reconnect:failure', this.stats.currentAttempt, error);

    // Check if we should retry
    if (this.stats.currentAttempt < this.config.maxRetries) {
      // scheduleReconnect should be called externally with the connection function
      this.setState('idle');
    } else {
      this.setState('failed');
      this.emit('reconnect:exhausted', this.stats.currentAttempt, error);
    }
  }

  /**
   * Reset the reconnector state
   * Clears all statistics and timers, returning to idle state
   */
  reset(): void {
    // Clear any pending timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Reset stats
    this.stats = {
      currentAttempt: 0,
      totalReconnections: 0,
      lastDelayMs: 0,
      state: 'idle',
    };

    // Reset internal state
    this.lastDelayMs = 0;

    // Update state
    this.setState('idle');
  }

  /**
   * Get current reconnection statistics
   *
   * @returns Copy of current statistics
   */
  getStats(): ReconnectionStats {
    return { ...this.stats };
  }

  /**
   * Get current configuration
   *
   * @returns Copy of current configuration
   */
  getConfig(): ExponentialBackoffConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * Note: This will reset the current state
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<ExponentialBackoffConfig>): void {
    this.config = { ...this.config, ...config };
    this.reset();
  }

  /**
   * Check if reconnection is in progress
   *
   * @returns True if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.stats.state === 'reconnecting' || this.stats.state === 'connecting';
  }

  /**
   * Check if reconnection has been exhausted
   *
   * @returns True if max retries reached
   */
  isExhausted(): boolean {
    return this.stats.state === 'failed';
  }

  /**
   * Check if currently connected
   *
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.stats.state === 'connected';
  }

  /**
   * Cleanup resources
   * Should be called when the reconnector is no longer needed
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.removeAllListeners();
  }
}