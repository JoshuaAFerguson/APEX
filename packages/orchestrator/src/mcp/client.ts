import { EventEmitter } from 'eventemitter3';
import type { MCPTransport } from './transports/transport.js';
import {
  JSONRPCMessage,
  JSONRPCResponse,
  JSONRPCRequest,
  JSONRPCErrorResponse,
  isJSONRPCResponse,
  isJSONRPCErrorResponse,
  createJSONRPCRequest,
} from './types.js';

export interface MCPClientOptions {
  transport: MCPTransport;
  timeoutMs?: number;
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPClientEvents {
  'notification': (message: JSONRPCMessage) => void;
  'error': (error: Error) => void;
}

interface PendingRequest {
  resolve: (value: JSONRPCResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class MCPClient extends EventEmitter<MCPClientEvents> {
  private transport: MCPTransport;
  private timeoutMs: number;
  private nextId = 1;
  private pendingRequests: Map<number | string, PendingRequest> = new Map();

  constructor(options: MCPClientOptions) {
    super();
    this.transport = options.transport;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.transport.on('message', (message) => this.handleMessage(message));
    this.transport.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async disconnect(): Promise<void> {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MCP client disconnected'));
    }
    this.pendingRequests.clear();
    await this.transport.disconnect();
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    const response = await this.sendRequest('tools/list');
    const result = this.unwrapResponse(response);
    if (!result || typeof result !== 'object' || !Array.isArray((result as any).tools)) {
      return [];
    }
    return (result as any).tools as MCPToolDefinition[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    const result = this.unwrapResponse(response);
    return (result as any)?.content ?? result;
  }

  /**
   * Send a ping message to test connection health
   * This is the preferred method for health checks over listTools()
   * @returns Promise that resolves when the pong response is received
   */
  async ping(): Promise<void> {
    const response = await this.sendRequest('ping');
    this.unwrapResponse(response);
    // If we get here, the ping was successful (no error thrown)
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<JSONRPCResponse> {
    const requestId = this.nextId++;
    const request: JSONRPCRequest = createJSONRPCRequest(requestId, method, params);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`MCP request timeout: ${method}`));
      }, this.timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.transport.send(request).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      });
    });
  }

  private handleMessage(message: JSONRPCMessage): void {
    if (isJSONRPCResponse(message)) {
      if (message.id == null) {
        return;
      }
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (isJSONRPCErrorResponse(message)) {
        pending.reject(this.convertError(message));
      } else {
        pending.resolve(message);
      }
      return;
    }

    this.emit('notification', message);
  }

  private convertError(message: JSONRPCErrorResponse): Error {
    return new Error(
      message.error?.message || `MCP error ${message.error?.code ?? 'unknown'}`
    );
  }

  private unwrapResponse(response: JSONRPCResponse): unknown {
    if ('result' in response) {
      return response.result;
    }
    return undefined;
  }
}
