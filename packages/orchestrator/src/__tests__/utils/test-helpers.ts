/**
 * Test Utilities and Helpers for MCP Integration Tests
 *
 * This module provides common utilities and helpers for testing
 * MCP functionality across different test suites.
 */

import { vi } from 'vitest';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import type { MCPToolDefinition } from '../../mcp/client.js';
import { MockMCPServer, createMockServer, createMockClient } from './mock-mcp-server.js';

// ============================================================================
// Test Configuration Builders
// ============================================================================

export interface TestConfigOptions {
  servers?: Record<string, MCPServerConfig>;
  connectionSettings?: {
    maxRetries?: number;
    retryDelayMs?: number;
    connectionTimeoutMs?: number;
    autoReconnect?: boolean;
    healthCheckIntervalMs?: number;
  };
  limits?: {
    maxConcurrentTasks?: number;
    maxDailyTasks?: number;
    maxTokensPerTask?: number;
    maxTurns?: number;
  };
}

export function createTestConfig(options: TestConfigOptions = {}): ApexConfig {
  return {
    project: {
      name: 'test-project',
      version: '1.0.0'
    },
    limits: {
      maxConcurrentTasks: 10,
      maxDailyTasks: 100,
      maxTokensPerTask: 100000,
      maxTurns: 10,
      ...options.limits
    },
    mcp: {
      enabled: true,
      servers: options.servers || {},
      connection: {
        maxRetries: 3,
        retryDelayMs: 100,
        connectionTimeoutMs: 5000,
        autoReconnect: true,
        healthCheckIntervalMs: 30000,
        ...options.connectionSettings
      }
    },
    autonomy: { level: 'manual' as const },
    agents: {},
    workflows: {}
  };
}

export function createServerConfig(
  id: string,
  type: 'stdio' | 'http' | 'sse' = 'stdio',
  overrides: Partial<MCPServerConfig> = {}
): MCPServerConfig {
  const baseConfig: MCPServerConfig = {
    name: `Test Server ${id}`,
    type,
    command: type === 'stdio' ? `mock-${id}-server` : undefined,
    url: type !== 'stdio' ? `http://localhost:3000/${id}` : undefined,
    args: [],
    env: {},
    ...overrides
  };

  return baseConfig;
}

// ============================================================================
// Mock Setup Utilities
// ============================================================================

export interface MockSetupResult {
  servers: Map<string, MockMCPServer>;
  transports: Map<string, any>;
  clients: Map<string, any>;
  cleanup: () => void;
}

export function setupMockInfrastructure(serverIds: string[]): MockSetupResult {
  const servers = new Map<string, MockMCPServer>();
  const transports = new Map<string, any>();
  const clients = new Map<string, any>();

  // Create mock servers
  for (const serverId of serverIds) {
    const server = createMockServer(serverId, serverId as any);
    servers.set(serverId, server);
  }

  // Mock transport factory
  const { StdioTransport } = require('../../mcp/transports/index.js');
  const originalTransportImpl = StdioTransport.getMockImplementation();

  StdioTransport.mockImplementation((options: any) => {
    const serverId = extractServerIdFromCommand(options.command) || 'default';
    const server = servers.get(serverId);

    if (!server) {
      throw new Error(`No mock server found for ID: ${serverId}`);
    }

    const transport = {
      connect: () => server.connect(),
      disconnect: () => server.disconnect(),
      isConnected: () => server.isConnected(),
      send: (message: any) => server.request(message.method, message.params),
      on: (event: string, handler: Function) => server.on(event, handler),
      off: (event: string, handler: Function) => server.off(event, handler),
      emit: (event: string, ...args: any[]) => server.emit(event, ...args)
    };

    transports.set(serverId, transport);
    return transport;
  });

  // Mock client factory
  const { MCPClient } = require('../../mcp/client.js');
  const originalClientImpl = MCPClient.getMockImplementation();

  MCPClient.mockImplementation(({ transport }: any) => {
    const client = {
      connect: () => transport.connect(),
      disconnect: () => transport.disconnect(),
      listTools: async () => {
        const result = await transport.send({ method: 'tools/list' });
        return result.tools;
      },
      callTool: (name: string, args: any) =>
        transport.send({ method: 'tools/call', params: { name, arguments: args } }),
      ping: () => transport.send({ method: 'ping' }),
      on: (event: string, handler: Function) => transport.on(event, handler),
      off: (event: string, handler: Function) => transport.off(event, handler),
      transport
    };

    // Find server ID for this client
    const serverId = Array.from(transports.entries())
      .find(([, t]) => t === transport)?.[0];
    if (serverId) {
      clients.set(serverId, client);
    }

    return client;
  });

  const cleanup = () => {
    servers.clear();
    transports.clear();
    clients.clear();

    if (originalTransportImpl) {
      StdioTransport.mockImplementation(originalTransportImpl);
    }
    if (originalClientImpl) {
      MCPClient.mockImplementation(originalClientImpl);
    }
  };

  return { servers, transports, clients, cleanup };
}

function extractServerIdFromCommand(command: string): string | null {
  const match = command.match(/mock-(\w+)-server/);
  return match ? match[1] : null;
}

// ============================================================================
// Test Data Generators
// ============================================================================

export function generateTestTools(serverId: string, count: number = 5): MCPToolDefinition[] {
  const toolTypes = ['reader', 'writer', 'analyzer', 'transformer', 'validator'];
  const tools: MCPToolDefinition[] = [];

  for (let i = 0; i < count; i++) {
    const type = toolTypes[i % toolTypes.length];
    tools.push({
      name: `${serverId}-${type}-${i}`,
      description: `${type} tool for ${serverId} (${i})`,
      inputSchema: generateTestSchema(type, i)
    });
  }

  return tools;
}

export function generateTestSchema(type: string, variant: number): any {
  const schemas = {
    reader: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source to read from' },
        format: { type: 'string', enum: ['json', 'xml', 'csv'], default: 'json' }
      },
      required: ['source']
    },
    writer: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Destination to write to' },
        data: { type: 'string', description: 'Data to write' },
        mode: { type: 'string', enum: ['overwrite', 'append'], default: 'overwrite' }
      },
      required: ['destination', 'data']
    },
    analyzer: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input to analyze' },
        depth: { type: 'string', enum: ['shallow', 'deep'], default: 'shallow' },
        metrics: { type: 'array', items: { type: 'string' } }
      },
      required: ['input']
    },
    transformer: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input to transform' },
        transformation: { type: 'string', description: 'Transformation to apply' },
        options: { type: 'object', additionalProperties: true }
      },
      required: ['input', 'transformation']
    },
    validator: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data to validate' },
        schema: { type: 'string', description: 'Schema to validate against' },
        strict: { type: 'boolean', default: false }
      },
      required: ['data', 'schema']
    }
  };

  const schema = { ...schemas[type as keyof typeof schemas] };

  // Add variant-specific properties
  if (variant % 2 === 0) {
    (schema.properties as any).priority = {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      default: 5
    };
  }

  if (variant % 3 === 0) {
    (schema.properties as any).tags = {
      type: 'array',
      items: { type: 'string' }
    };
  }

  return schema;
}

// ============================================================================
// Event Tracking Utilities
// ============================================================================

export interface EventTracker {
  events: Array<{ type: string; data: any; timestamp: number }>;
  start: () => void;
  stop: () => void;
  getEvents: (type?: string) => Array<{ type: string; data: any; timestamp: number }>;
  getEventCount: (type?: string) => number;
  clear: () => void;
}

export function createEventTracker(emitter: any, eventTypes: string[]): EventTracker {
  const events: Array<{ type: string; data: any; timestamp: number }> = [];
  const handlers = new Map<string, Function>();
  let tracking = false;

  const tracker: EventTracker = {
    events,
    start() {
      if (tracking) return;
      tracking = true;

      for (const eventType of eventTypes) {
        const handler = (...args: any[]) => {
          events.push({
            type: eventType,
            data: args.length === 1 ? args[0] : args,
            timestamp: Date.now()
          });
        };
        handlers.set(eventType, handler);
        emitter.on(eventType, handler);
      }
    },
    stop() {
      if (!tracking) return;
      tracking = false;

      for (const [eventType, handler] of handlers) {
        emitter.off(eventType, handler);
      }
      handlers.clear();
    },
    getEvents(type) {
      return type ? events.filter(e => e.type === type) : [...events];
    },
    getEventCount(type) {
      return type ? events.filter(e => e.type === type).length : events.length;
    },
    clear() {
      events.length = 0;
    }
  };

  return tracker;
}

// ============================================================================
// Performance Testing Utilities
// ============================================================================

export interface PerformanceResult {
  duration: number;
  operationsPerSecond: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  errorRate: number;
  successCount: number;
  errorCount: number;
}

export async function measurePerformance<T>(
  operation: () => Promise<T>,
  iterations: number = 100
): Promise<PerformanceResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const operationStart = Date.now();
    try {
      await operation();
      successCount++;
    } catch (error) {
      errorCount++;
    }
    const operationEnd = Date.now();
    latencies.push(operationEnd - operationStart);
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  return {
    duration,
    operationsPerSecond: (iterations / duration) * 1000,
    averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    errorRate: errorCount / iterations,
    successCount,
    errorCount
  };
}

export async function measureConcurrentPerformance<T>(
  operation: () => Promise<T>,
  concurrentCount: number = 10,
  iterationsPerWorker: number = 10
): Promise<PerformanceResult> {
  const workers = Array.from({ length: concurrentCount }, async () => {
    return measurePerformance(operation, iterationsPerWorker);
  });

  const results = await Promise.all(workers);

  // Aggregate results
  const totalSuccessCount = results.reduce((sum, r) => sum + r.successCount, 0);
  const totalErrorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
  const totalOperations = totalSuccessCount + totalErrorCount;
  const maxDuration = Math.max(...results.map(r => r.duration));

  const allLatencies = results.flatMap(r => [r.minLatency, r.maxLatency, r.averageLatency]);

  return {
    duration: maxDuration,
    operationsPerSecond: (totalOperations / maxDuration) * 1000,
    averageLatency: results.reduce((sum, r) => sum + r.averageLatency, 0) / results.length,
    minLatency: Math.min(...allLatencies),
    maxLatency: Math.max(...allLatencies),
    errorRate: totalErrorCount / totalOperations,
    successCount: totalSuccessCount,
    errorCount: totalErrorCount
  };
}

// ============================================================================
// Test Assertion Helpers
// ============================================================================

export function expectEventSequence(tracker: EventTracker, expectedSequence: string[]): void {
  const actualSequence = tracker.events.map(e => e.type);

  for (let i = 0; i < expectedSequence.length; i++) {
    const expected = expectedSequence[i];
    const actual = actualSequence[i];

    if (actual !== expected) {
      throw new Error(
        `Event sequence mismatch at index ${i}. Expected '${expected}' but got '${actual}'. ` +
        `Full sequence: ${JSON.stringify(actualSequence)}`
      );
    }
  }
}

export function expectPerformanceWithinLimits(
  result: PerformanceResult,
  limits: {
    maxAverageLatency?: number;
    minOperationsPerSecond?: number;
    maxErrorRate?: number;
  }
): void {
  if (limits.maxAverageLatency && result.averageLatency > limits.maxAverageLatency) {
    throw new Error(
      `Average latency ${result.averageLatency}ms exceeds limit of ${limits.maxAverageLatency}ms`
    );
  }

  if (limits.minOperationsPerSecond && result.operationsPerSecond < limits.minOperationsPerSecond) {
    throw new Error(
      `Operations per second ${result.operationsPerSecond} below minimum of ${limits.minOperationsPerSecond}`
    );
  }

  if (limits.maxErrorRate && result.errorRate > limits.maxErrorRate) {
    throw new Error(
      `Error rate ${result.errorRate} exceeds maximum of ${limits.maxErrorRate}`
    );
  }
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

export class TestResourceManager {
  private resources: Array<() => Promise<void> | void> = [];

  addResource(cleanup: () => Promise<void> | void): void {
    this.resources.push(cleanup);
  }

  async cleanup(): Promise<void> {
    const cleanupPromises = this.resources.map(cleanup => {
      try {
        const result = cleanup();
        return Promise.resolve(result);
      } catch (error) {
        return Promise.reject(error);
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.resources.length = 0;
  }
}

// ============================================================================
// Common Test Scenarios
// ============================================================================

export const TEST_SCENARIOS = {
  BASIC_CONNECTIVITY: 'basic-connectivity',
  HIGH_LOAD: 'high-load',
  ERROR_RECOVERY: 'error-recovery',
  NETWORK_PARTITION: 'network-partition',
  GRADUAL_DEGRADATION: 'gradual-degradation',
  CONCURRENT_ACCESS: 'concurrent-access',
  TOOL_DISCOVERY: 'tool-discovery',
  HEALTH_MONITORING: 'health-monitoring'
} as const;

export type TestScenario = typeof TEST_SCENARIOS[keyof typeof TEST_SCENARIOS];