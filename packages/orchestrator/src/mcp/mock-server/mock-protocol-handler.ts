/**
 * @fileoverview MockMCPProtocolHandler - MCP Protocol Message Router
 *
 * Routes incoming JSON-RPC requests to appropriate handlers and manages
 * MCP protocol state (initialization handshake, capabilities negotiation).
 *
 * @module orchestrator/mcp/mock-server/mock-protocol-handler
 */

import type {
  MockMCPServerConfig,
  MockBehaviorConfig,
  MockToolHandler,
} from '@apexcli/core';
import {
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCNotification,
  createJSONRPCSuccessResponse,
  createJSONRPCErrorResponse,
  createJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCNotification,
  JSONRPCErrorCodes,
} from '../types.js';
import { MockBehaviorEngine } from './mock-behavior-engine.js';
import type {
  ProtocolState,
  RecordedRequest,
  RecordedNotification,
} from './types.js';

// ============================================================================
// MockMCPProtocolHandler
// ============================================================================

/**
 * Handles MCP protocol message routing and lifecycle management.
 *
 * This class processes incoming JSON-RPC messages, routes them to appropriate
 * handlers, and manages the MCP protocol lifecycle (initialization handshake,
 * capabilities, etc.). It uses the MockBehaviorEngine for configurable behaviors
 * like delays, error injection, and state management.
 *
 * @example
 * ```typescript
 * const handler = new MockMCPProtocolHandler(serverConfig, behaviorConfig);
 *
 * // Process a request
 * const response = await handler.handleMessage(request);
 *
 * // Check protocol state
 * console.log(handler.isInitialized()); // true after initialize handshake
 *
 * // Get request history
 * const history = handler.getRequestHistory();
 * ```
 */
export class MockMCPProtocolHandler {
  private serverConfig: MockMCPServerConfig;
  private behaviorEngine: MockBehaviorEngine;
  private protocolState: ProtocolState = 'uninitialized';
  private notifications: RecordedNotification[] = [];
  private pendingNotifications: JSONRPCNotification[] = [];

  constructor(
    serverConfig: MockMCPServerConfig,
    behaviorConfig: MockBehaviorConfig
  ) {
    this.serverConfig = serverConfig;
    this.behaviorEngine = new MockBehaviorEngine(behaviorConfig);
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Handle an incoming JSON-RPC message.
   * Returns a response for requests, or undefined for notifications.
   */
  async handleMessage(
    message: JSONRPCMessage
  ): Promise<{ response?: JSONRPCResponse; notifications: JSONRPCNotification[] }> {
    if (isJSONRPCRequest(message)) {
      return this.handleRequest(message);
    }

    if (isJSONRPCNotification(message)) {
      this.handleNotification(message);
      return { notifications: [] };
    }

    // Unexpected message type (response from client?) - ignore
    return { notifications: [] };
  }

  /**
   * Handle a JSON-RPC request and return a response.
   */
  private async handleRequest(
    request: JSONRPCRequest
  ): Promise<{ response: JSONRPCResponse; notifications: JSONRPCNotification[] }> {
    const startTime = Date.now();
    this.pendingNotifications = [];

    try {
      // Check error injection first
      const errorResult = this.behaviorEngine.checkErrorInjection(request.method);
      if (errorResult.shouldInject) {
        // Apply error delay if configured
        if (errorResult.delayMs && errorResult.delayMs > 0) {
          await this.sleep(errorResult.delayMs);
        }

        const response = createJSONRPCErrorResponse(
          request.id,
          errorResult.errorCode ?? JSONRPCErrorCodes.INTERNAL_ERROR,
          errorResult.errorMessage ?? 'Mock injected error',
          errorResult.errorData
        );

        this.recordRequest(request, response, startTime, true);
        return { response, notifications: this.pendingNotifications };
      }

      // Apply response delay
      await this.behaviorEngine.applyDelay(request.method);

      // Check if initialization is required
      if (request.method !== 'initialize' && this.protocolState !== 'initialized') {
        // Some methods should work before initialization (like ping)
        if (!this.isPreInitMethod(request.method)) {
          const response = createJSONRPCErrorResponse(
            request.id,
            JSONRPCErrorCodes.INVALID_REQUEST,
            'Server not initialized. Send initialize request first.'
          );
          this.recordRequest(request, response, startTime, false);
          return { response, notifications: this.pendingNotifications };
        }
      }

      // Attempt state transition
      const transition = this.behaviorEngine.transition(
        request.method,
        request.params as Record<string, unknown> | undefined
      );

      if (transition?.transition.emitNotification) {
        const notif = createJSONRPCNotification(
          transition.transition.emitNotification.method,
          transition.transition.emitNotification.params
        );
        this.pendingNotifications.push(notif);
      }

      // Check notification triggers
      const triggers = this.behaviorEngine.checkNotificationTriggers(request.method);
      for (const trigger of triggers) {
        const notif = createJSONRPCNotification(trigger.method, trigger.params);
        this.pendingNotifications.push(notif);
        this.notifications.push({
          notification: notif,
          timestamp: Date.now(),
          triggerCondition: trigger.condition,
        });
      }

      // Route to method handler
      const result = await this.routeMethod(request);
      const response = createJSONRPCSuccessResponse(request.id, result);

      this.recordRequest(request, response, startTime, false);
      return { response, notifications: this.pendingNotifications };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response = createJSONRPCErrorResponse(
        request.id,
        JSONRPCErrorCodes.INTERNAL_ERROR,
        errorMessage
      );
      this.recordRequest(request, response, startTime, false);
      return { response, notifications: this.pendingNotifications };
    }
  }

  /**
   * Handle a JSON-RPC notification (no response expected).
   */
  private handleNotification(notification: JSONRPCNotification): void {
    if (notification.method === 'notifications/initialized') {
      // Client confirms initialization
      if (this.protocolState === 'initializing') {
        this.protocolState = 'initialized';
      }
    }

    // Attempt state transition for notifications too
    this.behaviorEngine.transition(
      notification.method,
      notification.params as Record<string, unknown> | undefined
    );
  }

  // ==========================================================================
  // Method Routing
  // ==========================================================================

  /**
   * Route a request to the appropriate method handler.
   */
  private async routeMethod(request: JSONRPCRequest): Promise<unknown> {
    const params = request.params as Record<string, unknown> | undefined;

    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(params);

      case 'ping':
        return this.handlePing();

      case 'tools/list':
        return this.handleToolsList(params);

      case 'tools/call':
        return this.handleToolsCall(params);

      case 'resources/list':
        return this.handleResourcesList(params);

      case 'resources/read':
        return this.handleResourcesRead(params);

      case 'prompts/list':
        return this.handlePromptsList(params);

      case 'prompts/get':
        return this.handlePromptsGet(params);

      case 'logging/setLevel':
        return this.handleLoggingSetLevel(params);

      case 'completion/complete':
        return this.handleCompletionComplete(params);

      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }

  // ==========================================================================
  // Protocol Method Handlers
  // ==========================================================================

  private async handleInitialize(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    this.protocolState = 'initializing';

    // Return server capabilities and info
    const result = {
      protocolVersion: this.serverConfig.protocolVersion,
      capabilities: this.serverConfig.capabilities,
      serverInfo: {
        name: this.serverConfig.serverInfo.name,
        version: this.serverConfig.serverInfo.version,
      },
      ...(this.serverConfig.instructions && {
        instructions: this.serverConfig.instructions,
      }),
    };

    // Mark as initialized (in MCP, client sends 'initialized' notification after)
    // But we'll allow immediate use for simpler test scenarios
    this.protocolState = 'initialized';

    return result;
  }

  private async handlePing(): Promise<unknown> {
    return {};
  }

  private async handleToolsList(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    // Collect tools from all registered handlers
    const handlers = this.getActiveToolHandlers();
    const tools = handlers.map(h => ({
      name: h.toolName,
      description: `Mock tool: ${h.toolName}`,
      inputSchema: { type: 'object' as const },
    }));

    return { tools };
  }

  private async handleToolsCall(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    if (!params || typeof params.name !== 'string') {
      throw new Error('Invalid tools/call params: missing name');
    }

    const toolName = params.name;
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    // Find matching handler
    const handler = this.behaviorEngine.findToolHandler(toolName, args);

    if (handler) {
      // Apply tool-specific delay if configured
      if (handler.delayMs && handler.delayMs > 0) {
        await this.sleep(handler.delayMs);
      }

      return {
        content: handler.response.content,
        isError: handler.response.isError,
      };
    }

    // Check for default tool response
    const defaultResponse = this.behaviorEngine.getDefaultToolResponse();
    if (defaultResponse) {
      return {
        content: defaultResponse.content,
        isError: defaultResponse.isError,
      };
    }

    // No handler found
    throw new Error(`Tool not found: ${toolName}`);
  }

  private async handleResourcesList(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    // Return empty resources list by default
    return { resources: [] };
  }

  private async handleResourcesRead(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    if (!params || typeof params.uri !== 'string') {
      throw new Error('Invalid resources/read params: missing uri');
    }
    // Return empty content by default
    return { contents: [] };
  }

  private async handlePromptsList(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    return { prompts: [] };
  }

  private async handlePromptsGet(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    if (!params || typeof params.name !== 'string') {
      throw new Error('Invalid prompts/get params: missing name');
    }
    return { messages: [] };
  }

  private async handleLoggingSetLevel(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    return {};
  }

  private async handleCompletionComplete(
    params: Record<string, unknown> | undefined
  ): Promise<unknown> {
    return { completion: { values: [] } };
  }

  // ==========================================================================
  // State Inspection
  // ==========================================================================

  /**
   * Check if the server has been initialized.
   */
  isInitialized(): boolean {
    return this.protocolState === 'initialized';
  }

  /**
   * Get the current protocol state.
   */
  getProtocolState(): ProtocolState {
    return this.protocolState;
  }

  /**
   * Get the current behavior engine state.
   */
  getServerState(): string {
    return this.behaviorEngine.getCurrentState();
  }

  /**
   * Get all recorded requests.
   */
  getRequestHistory(): RecordedRequest[] {
    return this.behaviorEngine.getRecordedRequests();
  }

  /**
   * Get all sent notifications.
   */
  getSentNotifications(): RecordedNotification[] {
    return [...this.notifications];
  }

  /**
   * Get the behavior engine for direct access.
   */
  getBehaviorEngine(): MockBehaviorEngine {
    return this.behaviorEngine;
  }

  // ==========================================================================
  // Configuration Updates
  // ==========================================================================

  /**
   * Update the server configuration.
   */
  updateServerConfig(config: MockMCPServerConfig): void {
    this.serverConfig = config;
  }

  /**
   * Update the behavior configuration.
   */
  updateBehaviorConfig(config: MockBehaviorConfig): void {
    this.behaviorEngine.updateConfig(config);
  }

  /**
   * Reset protocol state and behavior engine.
   */
  reset(): void {
    this.protocolState = 'uninitialized';
    this.notifications = [];
    this.pendingNotifications = [];
    this.behaviorEngine.reset();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get the active tool handlers from the behavior engine.
   */
  private getActiveToolHandlers(): MockToolHandler[] {
    // We need to check all tools registered in the behavior config
    // This uses the behavior engine's internal logic for state-aware handlers
    const stateBehavior = this.behaviorEngine.getCurrentStateBehavior();
    if (stateBehavior && stateBehavior.toolHandlers.length > 0) {
      return stateBehavior.toolHandlers;
    }
    // Access the config directly for tool list purposes
    return [];
  }

  /**
   * Check if a method can be called before initialization.
   */
  private isPreInitMethod(method: string): boolean {
    return ['ping', 'initialize'].includes(method);
  }

  /**
   * Record a processed request in the behavior engine.
   */
  private recordRequest(
    request: JSONRPCRequest,
    response: JSONRPCResponse,
    startTime: number,
    errorInjected: boolean
  ): void {
    this.behaviorEngine.recordRequest({
      request,
      response,
      timestamp: startTime,
      durationMs: Date.now() - startTime,
      errorInjected,
      serverState: this.behaviorEngine.getCurrentState(),
    });
  }

  /**
   * Sleep for the specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
