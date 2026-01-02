/**
 * StdioTransport - MCP transport implementation using child process stdio
 *
 * This module implements the MCPTransport interface for communication with
 * MCP servers via stdin/stdout of a spawned child process. Messages are
 * framed using newline-delimited JSON.
 *
 * @module orchestrator/mcp/transports/stdio-transport
 */

import { spawn, ChildProcess } from 'child_process';
import { JSONRPCMessage, MCPTransportError } from '../types.js';
import { MCPTransport, MCPTransportBaseOptions } from './transport.js';

// ============================================================================
// Stdio Transport Options
// ============================================================================

/**
 * Configuration options for StdioTransport
 */
export interface StdioTransportOptions extends MCPTransportBaseOptions {
  /**
   * Command to execute (e.g., 'node', 'python', 'npx')
   */
  command: string;

  /**
   * Command arguments (e.g., ['./mcp-server.js'])
   * @default []
   */
  args?: string[];

  /**
   * Working directory for the spawned process
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Environment variables for the spawned process
   * Merged with process.env
   */
  env?: Record<string, string>;

  /**
   * Whether to inherit environment from parent process
   * @default true
   */
  inheritEnv?: boolean;

  /**
   * Graceful shutdown timeout in milliseconds
   * After this timeout, SIGKILL is sent
   * @default 5000
   */
  shutdownTimeout?: number;
}

// ============================================================================
// StdioTransport Class
// ============================================================================

/**
 * MCP transport implementation using child process stdin/stdout
 *
 * StdioTransport spawns a child process and communicates with it via
 * stdin (for sending) and stdout (for receiving). Messages are framed
 * using newline-delimited JSON.
 *
 * Features:
 * - Automatic process lifecycle management
 * - Buffered message parsing for partial data
 * - Graceful shutdown with timeout
 * - stderr capture for debugging
 * - Crash detection and optional auto-restart
 *
 * @example
 * ```typescript
 * const transport = new StdioTransport({
 *   command: 'node',
 *   args: ['./mcp-server.js'],
 *   cwd: '/path/to/server',
 * });
 *
 * transport.on('message', (message) => {
 *   console.log('Received:', message);
 * });
 *
 * transport.on('stderr', (data) => {
 *   console.log('Server stderr:', data);
 * });
 *
 * await transport.connect();
 *
 * // Send a request
 * await transport.send({
 *   jsonrpc: '2.0',
 *   id: 1,
 *   method: 'tools/list',
 * });
 *
 * // Later...
 * await transport.disconnect();
 * ```
 */
export class StdioTransport extends MCPTransport {
  /**
   * Transport-specific configuration
   */
  private options: Required<Omit<StdioTransportOptions, keyof MCPTransportBaseOptions>> & MCPTransportBaseOptions;

  /**
   * Child process handle
   */
  private process: ChildProcess | null = null;

  /**
   * Buffer for incomplete messages
   */
  private messageBuffer = '';

  /**
   * Whether we initiated the disconnection
   */
  private disconnectInitiated = false;

  /**
   * Create a new StdioTransport instance
   *
   * @param options - Transport configuration
   */
  constructor(options: StdioTransportOptions) {
    super(options);

    this.options = {
      ...options,
      args: options.args ?? [],
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? {},
      inheritEnv: options.inheritEnv ?? true,
      shutdownTimeout: options.shutdownTimeout ?? 5000,
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Spawn the child process and establish communication
   *
   * @throws {MCPTransportError} If spawn fails or times out
   */
  async connect(): Promise<void> {
    // Validate state
    if (this._state === 'connected') {
      throw new MCPTransportError(
        'Transport is already connected',
        'ALREADY_CONNECTED'
      );
    }

    if (this._state === 'connecting') {
      throw new MCPTransportError(
        'Connection already in progress',
        'ALREADY_CONNECTED'
      );
    }

    this.setState('connecting');
    this.disconnectInitiated = false;
    this.messageBuffer = '';

    try {
      // Build environment
      const env = this.options.inheritEnv
        ? { ...process.env, ...this.options.env }
        : this.options.env;

      // Spawn the process
      this.process = spawn(this.options.command, this.options.args, {
        cwd: this.options.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Don't detach - we want to manage the lifecycle
        detached: false,
      });

      // Set up event handlers
      this.setupProcessHandlers();

      // Wait for process to be ready (or fail)
      await this.waitForProcessReady();

      this.setState('connected');
    } catch (error) {
      this.setState('error');
      await this.cleanupProcess();

      if (error instanceof MCPTransportError) {
        throw error;
      }

      throw new MCPTransportError(
        `Failed to spawn process: ${(error as Error).message}`,
        'SPAWN_FAILED',
        error as Error
      );
    }
  }

  /**
   * Close the child process and release resources
   *
   * @param reason - Optional reason for disconnection
   */
  async disconnect(reason?: string): Promise<void> {
    if (this._state === 'disconnected' || this._state === 'disconnecting') {
      return;
    }

    this.setState('disconnecting');
    this.disconnectInitiated = true;

    await this.cleanupProcess();
    this.setState('disconnected', reason);
  }

  /**
   * Send a JSON-RPC message to the MCP server
   *
   * @param message - Message to send
   * @throws {MCPTransportError} If not connected or write fails
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected() || !this.process?.stdin?.writable) {
      throw new MCPTransportError(
        'Cannot send message: transport is not connected',
        'NOT_CONNECTED'
      );
    }

    try {
      const data = this.serializeMessage(message) + '\n';

      await new Promise<void>((resolve, reject) => {
        this.process!.stdin!.write(data, 'utf8', (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new MCPTransportError(
        `Failed to send message: ${(error as Error).message}`,
        'SEND_FAILED',
        error as Error
      );
    }
  }

  /**
   * Get the process ID of the spawned child process
   *
   * @returns Process ID or undefined if not connected
   */
  getProcessId(): number | undefined {
    return this.process?.pid;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Set up event handlers for the child process
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    // Handle stdout data (incoming messages)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleStdoutData(data.toString('utf8'));
    });

    // Handle stderr data (logging/errors from server)
    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString('utf8').trim();
      if (message) {
        this.emit('stderr', message);
      }
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.handleProcessExit(code, signal);
    });

    // Handle process errors
    this.process.on('error', (error) => {
      this.handleProcessError(error);
    });

    // Handle stdin close (process closed its stdin)
    this.process.stdin?.on('error', (error) => {
      // Ignore EPIPE errors during shutdown
      if (!this.disconnectInitiated) {
        this.emit('error', new MCPTransportError(
          `stdin error: ${error.message}`,
          'SEND_FAILED',
          error
        ));
      }
    });
  }

  /**
   * Wait for the process to become ready
   *
   * For stdio transport, we consider the process ready once it's spawned
   * successfully and hasn't immediately exited with an error.
   */
  private async waitForProcessReady(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.process) {
        reject(new MCPTransportError(
          'Process was not created',
          'SPAWN_FAILED'
        ));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new MCPTransportError(
          `Process did not become ready within ${this.baseOptions.connectionTimeout}ms`,
          'TIMEOUT'
        ));
      }, this.baseOptions.connectionTimeout);

      // Check if process exited immediately
      const exitHandler = (code: number | null) => {
        clearTimeout(timeout);
        reject(new MCPTransportError(
          `Process exited immediately with code ${code}`,
          'SPAWN_FAILED'
        ));
      };

      // Check if process emitted an error
      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        reject(new MCPTransportError(
          `Process spawn error: ${error.message}`,
          'SPAWN_FAILED',
          error
        ));
      };

      this.process.once('exit', exitHandler);
      this.process.once('error', errorHandler);

      // If stdout is writable and process is running, we're ready
      // Give it a small delay to ensure the process is fully initialized
      setTimeout(() => {
        if (this.process?.stdin?.writable) {
          clearTimeout(timeout);
          this.process.removeListener('exit', exitHandler);
          this.process.removeListener('error', errorHandler);
          resolve();
        }
      }, 50);
    });
  }

  /**
   * Handle data received on stdout
   *
   * @param data - Raw string data from stdout
   */
  private handleStdoutData(data: string): void {
    // Append to buffer
    this.messageBuffer += data;

    // Process complete messages (newline-delimited)
    const lines = this.messageBuffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.messageBuffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const message = this.parseMessage(trimmed);
          this.emit('message', message);
        } catch (error) {
          this.emit('error', error as MCPTransportError);
        }
      }
    }
  }

  /**
   * Handle process exit event
   *
   * @param code - Exit code (null if terminated by signal)
   * @param signal - Signal that terminated the process (null if exited normally)
   */
  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    // Clear the process reference
    this.process = null;

    // If we initiated the disconnect, this is expected
    if (this.disconnectInitiated) {
      return;
    }

    // Unexpected exit
    const reason = signal
      ? `Process terminated by signal ${signal}`
      : `Process exited with code ${code}`;

    this.emit('error', new MCPTransportError(
      reason,
      'PROCESS_CRASHED'
    ));

    // Handle unexpected disconnect (may trigger auto-reconnect)
    this.handleUnexpectedDisconnect(reason);
  }

  /**
   * Handle process error event
   *
   * @param error - Error from the process
   */
  private handleProcessError(error: Error): void {
    // If we're already handling a disconnect, ignore
    if (this.disconnectInitiated) {
      return;
    }

    this.emit('error', new MCPTransportError(
      `Process error: ${error.message}`,
      'PROCESS_CRASHED',
      error
    ));
  }

  /**
   * Clean up the child process
   */
  private async cleanupProcess(): Promise<void> {
    if (!this.process) {
      return;
    }

    const proc = this.process;
    this.process = null;

    // Close stdin to signal we're done
    try {
      proc.stdin?.end();
    } catch {
      // Ignore errors closing stdin
    }

    // Try graceful shutdown first
    if (proc.pid && !proc.killed) {
      try {
        proc.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }

      // Wait for graceful exit or force kill
      await Promise.race([
        new Promise<void>((resolve) => {
          proc.once('exit', () => resolve());
        }),
        this.delay(this.options.shutdownTimeout).then(() => {
          // Force kill if still running
          try {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          } catch {
            // Ignore errors, process may already be dead
          }
        }),
      ]);
    }

    // Remove all listeners
    proc.removeAllListeners();
    proc.stdin?.removeAllListeners();
    proc.stdout?.removeAllListeners();
    proc.stderr?.removeAllListeners();

    // Clear buffer
    this.messageBuffer = '';
  }
}
