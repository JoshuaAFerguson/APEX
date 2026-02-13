# APEX Timeout Configuration and Wait Strategy Analysis

## Overview

This document provides a comprehensive analysis of timeout configurations and wait strategies in the APEX codebase, covering all timeout options available in types.ts, wait strategies implemented in the orchestrator, how timeouts are currently applied, and existing test patterns.

## Timeout Configuration Options in `types.ts`

The APEX codebase defines numerous timeout configurations across different components:

### 1. Tool Execution Timeouts

#### Custom Tool Timeout
- **Schema**: `timeoutMs: z.number().int().min(1).optional().default(60000)`
- **Location**: Line 1101 in types.ts
- **Purpose**: Timeout for custom tool execution
- **Default**: 60 seconds

#### Tool Invocation Timeout
- **Schema**: `timeout: z.number().min(0).optional()`
- **Location**: Line 1143 in types.ts
- **Purpose**: Optional timeout for tool invocations

#### Tool Alias Timeout
- **Schema**: `timeout: z.number().positive().optional()`
- **Location**: Line 1365 in types.ts
- **Purpose**: Tool execution timeout for aliases

### 2. Browser Automation Timeouts

#### Browser Launch Timeout
- **Schema**: `timeout: z.number().int().min(0).optional().default(0)`
- **Location**: Line 181 in types.ts
- **Purpose**: Maximum execution time for browser operations
- **Default**: No limit (0)

#### Page Load Timeout
- **Schema**: `pageLoadTimeout: z.number().int().min(0).optional()`
- **Location**: Line 271 in types.ts
- **Purpose**: Maximum page load timeout

#### Browser Default Timeout
- **Schema**: `timeout: z.number().int().min(1000).optional().default(30000)`
- **Location**: Line 738 in types.ts
- **Purpose**: Default timeout for browser operations
- **Default**: 30 seconds

#### Wait Options Timeout
- **Schema**: `timeout: z.number().int().min(0).optional()`
- **Location**: Line 458 in types.ts
- **Purpose**: Maximum time to wait for element states
- **Default**: 30 seconds

#### Navigation Timeout
- **Schema**: `timeout: z.number().int().min(0).optional()`
- **Location**: Line 497 in types.ts
- **Purpose**: Navigation timeout for page transitions

#### Wait for Selector Timeout
- **Schema**: `timeout?: number` parameter
- **Location**: Line 789 in types.ts
- **Purpose**: Element appearance waiting timeout

### 3. MCP (Model Context Protocol) Timeouts

#### Connection Timeout
- **Schema**: `connectionTimeoutMs: z.number().int().min(0).optional().default(10000)`
- **Location**: Line 3028 in types.ts
- **Purpose**: Connection establishment timeout
- **Default**: 10 seconds

#### Request Timeout
- **Schema**: `requestTimeoutMs: z.number().int().min(0).optional().default(30000)`
- **Location**: Line 3035 in types.ts
- **Purpose**: Individual request response timeout
- **Default**: 30 seconds

#### Idle Timeout
- **Schema**: `idleTimeoutMs: z.number().int().min(0).optional().default(300000)`
- **Location**: Line 3043 in types.ts
- **Purpose**: Connection idle timeout
- **Default**: 5 minutes

#### Health Check Timeout
- **Schema**: `healthCheckTimeoutMs: z.number().int().min(0).optional().default(5000)`
- **Location**: Line 3072 in types.ts
- **Purpose**: Health check response timeout
- **Default**: 5 seconds

#### Tool Invocation Timeout
- **Schema**: `invocationTimeoutMs: z.number().min(1000).optional().default(30000)`
- **Location**: Line 3254 in types.ts
- **Purpose**: MCP tool invocation timeout
- **Default**: 30 seconds

### 4. Approval and Gate Timeouts

#### Gate Timeout
- **Schema**: `timeout: z.number().min(1).optional()`
- **Location**: Line 1572 in types.ts
- **Purpose**: Gate approval timeout in minutes

#### Approval Timeout (Global)
- **Schema**: `approvalTimeout: z.number().min(1).optional()`
- **Location**: Line 1673 in types.ts
- **Purpose**: Global approval timeout across gates and agents

#### Agent-Specific Approval Timeout
- **Schema**: `approvalTimeout: z.number().min(1).optional()`
- **Location**: Line 1633 in types.ts
- **Purpose**: Per-agent approval timeout override

#### Approval Request Timeout
- **Schema**: `timeoutMinutes: z.number().min(1).optional()`
- **Location**: Line 1797 in types.ts
- **Purpose**: Approval request expiration timeout

#### Approval Urgency-Based Timeout
- **Schema**: `timeoutMinutes: z.number().int().min(1).optional()`
- **Location**: Line 1797 in types.ts
- **Purpose**: Timeout based on urgency level
- **Defaults by urgency**:
  - Low: 1440 minutes (24 hours)
  - Normal: 60 minutes
  - High: 15 minutes
  - Critical: 5 minutes

### 5. System and Service Timeouts

#### Health Check Timeout
- **Schema**: `timeout: z.number().optional().default(5000)`
- **Location**: Line 2748 in types.ts
- **Purpose**: Service health check timeout
- **Default**: 5 seconds

#### Linter Timeout
- **Schema**: `timeoutMs: z.number().optional().default(30000)`
- **Location**: Line 2375 in types.ts
- **Purpose**: Individual linter execution timeout
- **Default**: 30 seconds

#### Global Linter Timeout
- **Schema**: `timeoutMs: z.number().optional().default(60000)`
- **Location**: Line 2410 in types.ts
- **Purpose**: Global timeout for all linters
- **Default**: 60 seconds

#### Typecheck Timeout
- **Schema**: `timeoutMs: z.number().optional().default(60000)`
- **Location**: Line 2474 in types.ts
- **Purpose**: TypeScript type checking timeout
- **Default**: 60 seconds

#### Hook Timeout
- **Schema**: `timeoutMs: z.number().int().min(1000).optional().default(30000)`
- **Location**: Line 8784 in types.ts
- **Purpose**: Hook execution timeout
- **Default**: 30 seconds

### 6. Development and Testing Timeouts

#### TDD Test Timeout
- **Schema**: `testTimeout?: number`
- **Location**: Line 6265 in types.ts
- **Purpose**: Test execution timeout in TDD mode

#### Dependency Installation Timeout
- **Schema**: `installTimeout: z.number().positive().optional()`
- **Location**: Line 4877 in types.ts
- **Purpose**: Package installation timeout

#### Preview Timeout
- **Schema**: `previewTimeout: z.number().min(1000).optional().default(5000)`
- **Location**: Line 2196 in types.ts
- **Purpose**: UI preview generation timeout
- **Default**: 5 seconds

#### Policy Check Timeout
- **Schema**: `timeoutMs: z.number().int().min(0).optional()`
- **Location**: Line 8357 in types.ts
- **Purpose**: Policy evaluation timeout

## Wait Strategies Implemented in Orchestrator

### 1. Browser Manager Wait Strategies

The `BrowserManager` class implements several timeout and wait strategies:

#### Browser Launch Timeout
- **Implementation**: `timeout: finalConfig.timeout` in launch options
- **Default**: 30 seconds (configurable)
- **Location**: `browser-manager.ts` line 241

#### Automatic Cleanup with Timeout
- **Implementation**: Graceful shutdown with timeout fallback
- **Method**: `cleanup()` with `CleanupOptions`
- **Timeout handling**: `Promise.race()` pattern
- **Fallback**: Force close after timeout
- **Location**: `browser-manager.ts` lines 441-483

#### Periodic Cleanup Timer
- **Implementation**: `setInterval` for automatic resource cleanup
- **Timeout**: `autoCleanupTimeout` (default 5 minutes)
- **Purpose**: Clean up inactive browsers and contexts
- **Location**: `browser-manager.ts` lines 580-618

### 2. MCP Client Timeout Implementation

The `MCPClient` class implements comprehensive timeout handling:

#### Request Timeout Strategy
- **Implementation**: `setTimeout` with pending request cleanup
- **Default**: 30 seconds configurable
- **Pattern**: Promise-based with timeout wrapper
- **Error handling**: Automatic cleanup on timeout
- **Location**: `mcp/client.ts` lines 93-110

```typescript
// Timeout implementation pattern from MCPClient
const timeout = setTimeout(() => {
  this.pendingRequests.delete(requestId);
  reject(new Error(`MCP request timeout: ${method}`));
}, this.timeoutMs);
```

#### Connection Cleanup on Disconnect
- **Implementation**: Clear all pending timeouts
- **Purpose**: Prevent memory leaks
- **Location**: `mcp/client.ts` lines 55-62

### 3. Connection Manager Wait Strategies

#### Connection Establishment with Timeout
- **Implementation**: `Promise.race()` pattern in `discoverAndRegisterMcpTools()`
- **Timeout**: 5 seconds per connection
- **Fallback**: Continue with other connections
- **Location**: `index.ts` lines 1805-1857

```typescript
// Connection timeout pattern from orchestrator
const connection = await Promise.race([
  this.mcpConnectionManager!.connect(serverId),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)), connectionTimeout)
  )
]);
```

#### Tool Refresh Timeout
- **Implementation**: 10-second timeout for tool discovery
- **Pattern**: `Promise.race()` with timeout rejection
- **Location**: `index.ts` lines 1847-1857

## Current Timeout Application Patterns

### 1. Promise.race() Pattern

Most timeout implementations use the `Promise.race()` pattern:
- One promise for the actual operation
- Another promise that rejects after timeout
- Used extensively in connection management and tool operations

### 2. setTimeout with Manual Cleanup

Used in MCP client and other request-response patterns:
- Set timeout when starting operation
- Clear timeout on completion or error
- Store timeout references for cleanup

### 3. Configuration Inheritance

Timeout configurations follow an inheritance pattern:
- Global defaults defined in schemas
- Per-service overrides possible
- Runtime parameter overrides supported

### 4. Graceful Degradation

Many timeout implementations include graceful degradation:
- Warning logs instead of hard failures
- Fallback to alternative methods
- Continued operation where possible

## Existing Test Patterns for Timeout Functionality

### 1. Timeout Simulation Tests

#### Container Execution Timeout Test
```typescript
it('should handle timeout scenarios appropriately', async () => {
  const result = await proxy.execute('timeout-test', timeoutContext, {
    timeout: 5000,
  });
  expect(result.success).toBe(false);
  expect(result.exitCode).toBe(124);
});
```

#### MCP Client Timeout Tests
```typescript
it('should handle process spawn timeout', async () => {
  // Simulate timeout by never calling spawn callback
  // Verify timeout error handling
});
```

### 2. Database Timeout Testing

#### Restore Task Timeout Tests
```typescript
it('should handle getTask timeout during validation', async () => {
  // Mock getTask to simulate timeout
  getTaskSpy.mockImplementationOnce(() =>
    Promise.reject(new Error('Database timeout'))
  );
  // Verify proper error handling
});
```

### 3. Approval Gate Timeout Testing

#### Workflow Integration Tests
```typescript
it('should handle approval timeout scenarios correctly', async () => {
  // Create workflow with short timeout (2 seconds)
  timeout: 2 # 2 seconds for testing
  // Test timeout behavior and cleanup
});
```

### 4. TDD Executor Timeout Testing

```typescript
it('should handle test command timeout', async () => {
  const shortConfig = { ...config, testTimeout: 100 };
  // Test with very short timeout to verify handling
});
```

### 5. Test Timeout Configuration

Many tests use extended timeouts for complex operations:
```typescript
}, 30000); // Increase timeout for this test
```

## Key Architectural Patterns

### 1. Defensive Programming

- All timeout configurations have sensible defaults
- Optional timeouts prevent blocking operations
- Multiple fallback strategies implemented

### 2. Event-Driven Cleanup

- EventEmitter pattern used extensively
- Proper resource cleanup on timeout
- Memory leak prevention through cleanup handlers

### 3. Configurable at Multiple Levels

- Global configuration defaults
- Per-service overrides
- Runtime parameter customization
- Environment-specific settings

### 4. Comprehensive Error Handling

- Specific timeout error messages
- Operation-specific timeout handling
- Graceful degradation strategies
- Proper resource cleanup on failure

## Recommendations for Future Development

### 1. Standardize Timeout Patterns

Consider creating a common timeout utility that:
- Standardizes the Promise.race() pattern
- Provides consistent error messages
- Handles cleanup automatically
- Supports cancellation tokens

### 2. Centralized Timeout Configuration

Consider a centralized timeout configuration system:
- Single source of truth for timeout values
- Environment-based configuration
- Dynamic timeout adjustment
- Monitoring and metrics integration

### 3. Enhanced Testing Utilities

Develop testing utilities for timeout scenarios:
- Timeout simulation helpers
- Configurable delay utilities
- Integration test patterns
- Performance testing tools

This analysis provides a complete picture of the current timeout and wait strategy implementation in APEX, serving as a foundation for understanding and extending the system's timeout handling capabilities.