# Timeout Configurations and Wait Strategies

This document provides comprehensive documentation of all timeout configurations and wait strategies available in the APEX codebase, including their usage patterns, defaults, and testing approaches.

## Table of Contents

1. [Overview](#overview)
2. [Timeout Configuration Schema](#timeout-configuration-schema)
3. [Wait Strategies](#wait-strategies)
4. [Browser Tool Timeouts](#browser-tool-timeouts)
5. [Orchestrator Timeouts](#orchestrator-timeouts)
6. [Testing Patterns](#testing-patterns)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

APEX implements comprehensive timeout and wait strategy configurations across multiple layers:

- **Schema-based Configuration**: Zod schemas in `packages/core/src/types.ts` define timeout types and validation
- **Browser Operations**: Playwright-based browser automation with configurable timeouts
- **Orchestrator Operations**: Task execution, MCP connections, and approval timeouts
- **Testing Infrastructure**: Comprehensive timeout testing with edge case coverage

## Timeout Configuration Schema

### Core Timeout Types (types.ts)

#### 1. Browser Navigation Timeouts

```typescript
// Navigation timeout in milliseconds
timeout: z.number().int().min(0).optional()

// Maximum page load timeout in milliseconds
pageLoadTimeout: z.number().int().min(0).optional()
```

#### 2. Browser Session Timeouts

```typescript
// Default timeout in milliseconds
timeout: z.number().int().min(1000).optional().default(30000)

// Preview timeout for UI operations
previewTimeout: z.number().min(1000).optional().default(5000)
```

#### 3. Tool Execution Timeouts

```typescript
// Timeout for tool execution in milliseconds
timeoutMs: z.number().int().min(1).optional().default(60000)

// Tool execution timeout in milliseconds
timeout: z.number().positive().optional()

// MCP tool invocation timeout (default: 30 seconds)
invocationTimeoutMs: z.number().min(1000).optional().default(30000)
```

#### 4. Approval Gate Timeouts

```typescript
// Timeout in minutes before the gate auto-rejects
timeout: z.number().min(1).optional()

// Whether to auto-approve if timeout is reached
autoApproveOnTimeout: z.boolean().default(false)

// Global approval timeout in minutes
approvalTimeout: z.number().min(1).optional()

// Agent-specific approval timeout override
approvalTimeout: z.number().min(1).optional()
```

#### 5. Connection and Network Timeouts

```typescript
// Connection timeout in milliseconds
connectionTimeoutMs: z.number().int().min(0).optional().default(10000)

// Request timeout in milliseconds
requestTimeoutMs: z.number().int().min(0).optional().default(30000)

// Idle timeout in milliseconds (0 = no timeout)
idleTimeoutMs: z.number().int().min(0).optional().default(300000)

// Health check timeout in milliseconds
healthCheckTimeoutMs: z.number().int().min(0).optional().default(5000)
```

#### 6. Linter and Hook Timeouts

```typescript
// Timeout for linter execution in milliseconds
timeoutMs: z.number().optional().default(30000)

// Global timeout for all linters in milliseconds
timeoutMs: z.number().optional().default(60000)

// Hook timeout in milliseconds
timeoutMs: z.number().int().min(1000).optional().default(30000)

// Default timeout for all hooks in milliseconds
defaultTimeoutMs: z.number().int().min(100).optional().default(30000)
```

#### 7. Dependency Installation Timeouts

```typescript
// Timeout for dependency installation in milliseconds
installTimeout: z.number().positive().optional()

// Default timeout for dependency installation
installTimeout: z.number().positive().optional()
```

#### 8. Gate Status and Approval Timeouts

```typescript
// Gate status includes 'timeout' as a possible state
GateStatusSchema = z.enum(['pending', 'approved', 'rejected', 'skipped', 'timeout'])

// Timeout configuration for approval requests
timeoutMinutes: z.number().min(1).optional()
timeoutAction: z.enum(['reject', 'approve', 'escalate']).optional().default('reject')

// Default timeout settings for rules
defaultTimeoutMinutes: z.number().int().min(1).optional().default(60)
defaultTimeoutAction: z.enum(['reject', 'approve', 'escalate']).optional().default('reject')
```

## Wait Strategies

### Browser Wait Strategies

#### 1. Navigation Wait Conditions

```typescript
// Wait until conditions for navigation
waitUntil: 'load' | 'domcontentloaded' | 'networkidle'

// Element visibility states
state: 'visible' | 'hidden' | 'attached' | 'detached'
```

#### 2. Element Wait Operations

```typescript
// Wait for selector with timeout
waitForSelector(selector: string, timeout?: number): Promise<BrowserActionResult>

// Wait for element with custom conditions
waitForElement(selector: string, options?: {
  timeout?: number,
  state?: 'visible' | 'hidden' | 'attached' | 'detached'
}): Promise<BrowserActionResult>

// Wait for function evaluation
waitForFunction(fn: Function | string, options?: { timeout?: number }): Promise<BrowserActionResult>

// Wait for load states
waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle', options?: { timeout?: number }): Promise<BrowserActionResult>

// Wait for network requests/responses
waitForRequest(urlPattern: RegExp, options?: { timeout?: number }): Promise<BrowserActionResult>
waitForResponse(urlPattern: RegExp, options?: { timeout?: number }): Promise<BrowserActionResult>

// Simple delay wait
waitFor(milliseconds: number): Promise<BrowserActionResult>
```

### Orchestrator Wait Strategies

#### 1. Auto-Resume with Delays

```typescript
// Schedule auto-resume with delay
private scheduleAutoResume(taskId: string, delayMs: number): void {
  setTimeout(async () => {
    // Resume task logic
  }, delayMs);
}
```

#### 2. Connection Establishment

```typescript
// MCP server connection with timeout wrapper
const connectionTimeout = 5000; // 5 second timeout per connection
const connection = await Promise.race([
  this.mcpConnectionManager!.connect(serverId),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)), connectionTimeout)
  )
]);
```

#### 3. Tool Refresh Operations

```typescript
// Tool refresh with timeout
await Promise.race([
  this.mcpToolRegistry.refreshAllTools(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Tool refresh timeout')), 10000)
  )
]);
```

#### 4. Approval Waiting

```typescript
// Wait for approval with configurable timeout
waitForApproval(requestId: string, timeoutMs: number = 30 * 60 * 1000): Promise<ApprovalResponse> {
  return new Promise((resolve, reject) => {
    // Set up timeout if specified
    if (timeoutMs > 0) {
      setTimeout(() => {
        const pendingPromise = this.pendingApprovalPromises.get(requestId);
        if (pendingPromise) {
          this.pendingApprovalPromises.delete(requestId);
          pendingPromise.reject(new Error(`Approval request ${requestId} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    }
  });
}
```

## Browser Tool Timeouts

### Configuration Options

```typescript
export interface BrowserNavigateParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number; // Maximum time to wait for navigation
}

export interface BrowserWaitForSelectorParams {
  selector: string;
  timeout?: number; // Maximum time to wait in milliseconds
  visible?: boolean; // Whether element should be visible
}

export interface BrowserConfig {
  timeout?: number; // Maximum execution time (0 = no limit)
  pageLoadTimeout?: number; // Maximum page load timeout
}
```

### Implementation Patterns

#### Navigation with Timeout

```typescript
// Navigate with custom timeout
const timeout = params.timeout || config?.pageLoadTimeout;
const response = await page.goto(url, {
  waitUntil: this.mapWaitUntil(waitUntil, backend),
  timeout,
});
```

#### Element Waiting with Timeout

```typescript
// Playwright-style waiting
await page.waitForSelector(selector, {
  timeout: waitParams.timeout,
  state: waitParams.visible ? 'visible' : 'attached',
});

// Puppeteer-style waiting
await page.waitForSelector(selector, {
  timeout: waitParams.timeout,
  visible: waitParams.visible || undefined,
});
```

## Orchestrator Timeouts

### MCP Connection Management

```typescript
// Configure MCP tool registry with operation timeout
this.mcpToolRegistry = new MCPToolRegistry({
  operationTimeoutMs: 30000,
  autoRefresh: false,
});
```

### Linter Service Configuration

```typescript
// Configure linter service with timeout
this.linterService = new LinterService({
  projectPath: this.projectPath,
  defaultTimeout: this.config.linter?.global?.timeoutMs,
  maxConcurrency: this.config.linter?.global?.maxConcurrency,
});
```

### Hook Manager Configuration

```typescript
// Configure tool hooks with timeout
this.config.toolHooks || {
  pre: [],
  post: [],
  enabled: true,
  defaultTimeoutMs: 30000
}
```

### Build and Test Execution

```typescript
// Build execution with timeout
const { stdout: buildOutput, stderr: buildStderr } = await execAsync('npm run build', {
  cwd: this.projectPath,
  timeout: 300000, // 5 minute timeout
});

// Test execution with timeout
const { stdout: testOutput, stderr: testStderr } = await execAsync('npm run test', {
  cwd: this.projectPath,
  timeout: 600000, // 10 minute timeout for tests
});
```

### Approval Gate Processing

```typescript
// Create approval state with timeout
const approvalState: ApprovalState = {
  id: generateApprovalId(),
  taskId: context.taskId,
  requestId: approvalRequest.requestId,
  status: 'pending',
  requestedAt: new Date(),
  approvalsReceived: 0,
  approvalsRequired: gateCheck.gate.minApprovals || 1,
  timeoutMinutes: gateCheck.gate.timeout,
  expiresAt: gateCheck.gate.timeout ? new Date(Date.now() + gateCheck.gate.timeout * 60000) : undefined,
  // ... other properties
};
```

## Testing Patterns

### Timeout Integration Tests

The codebase includes comprehensive timeout testing in `packages/browser/src/__tests__/timeout-configurations-integration.test.ts`:

#### Test Categories

1. **Default Timeout Behavior**
   - Session timeout inheritance
   - Navigation operation timeouts
   - Element interaction timeouts

2. **Custom Timeout Overrides**
   - Navigation operations with custom timeouts
   - Element interactions with custom timeouts
   - Wait operations with custom timeouts
   - Screenshot operations with custom timeouts

3. **Timeout Error Handling**
   - Descriptive timeout error messages
   - Session state preservation after timeouts

4. **Edge Cases and Boundary Conditions**
   - Zero timeout handling
   - Negative timeout handling
   - Very large timeout values

5. **Wait Strategy Timeout Behavior**
   - Different waitUntil strategies
   - Element state conditions
   - Advanced wait strategies

6. **Timeout Configuration Inheritance**
   - Session timeout inheritance
   - Method timeout overrides

7. **Timeout Accuracy and Performance**
   - Timeout accuracy within tolerance
   - Performance and overrun prevention

8. **Concurrent Operations**
   - Multiple operations with different timeouts

### Test Patterns and Assertions

#### Timeout Accuracy Testing

```typescript
it('should timeout with reasonable accuracy', async () => {
  const timeouts = [500, 1000, 1500, 2000];
  const tolerance = 0.3; // 30% tolerance for timing variance

  for (const timeout of timeouts) {
    const startTime = Date.now();
    const result = await session.waitForElement('#nonexistent', { timeout });
    const duration = Date.now() - startTime;

    expect(result.success).toBe(false);

    // Check timeout accuracy within tolerance
    const expectedMin = timeout * (1 - tolerance);
    const expectedMax = timeout * (1 + tolerance);

    expect(duration).toBeGreaterThanOrEqual(expectedMin);
    expect(duration).toBeLessThan(expectedMax);
  }
});
```

#### Error Message Testing

```typescript
it('should provide descriptive timeout error messages', async () => {
  const result = await session.click('#missing-button', { timeout: 500 });

  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
  expect(result.duration).toBeGreaterThan(0);

  // Error message should be descriptive
  const errorLower = result.error!.toLowerCase();
  expect(
    errorLower.includes('timeout') ||
    errorLower.includes('timed out') ||
    errorLower.includes('timedout')
  ).toBe(true);
});
```

#### Concurrent Timeout Testing

```typescript
it('should handle concurrent operations with different timeouts correctly', async () => {
  const operations = [
    { name: 'fast', operation: session.click('#nonexistent1', { timeout: 500 }) },
    { name: 'medium', operation: session.click('#nonexistent2', { timeout: 1000 }) },
    { name: 'slow', operation: session.click('#nonexistent3', { timeout: 1500 }) }
  ];

  const startTime = Date.now();
  const results = await Promise.all(operations.map(op => op.operation));
  const endTime = Date.now();

  // All should fail due to nonexistent elements
  results.forEach(result => {
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeout|timed out/i);
  });

  // Total time should be close to the longest timeout
  const totalDuration = endTime - startTime;
  expect(totalDuration).toBeGreaterThanOrEqual(1200); // Close to longest timeout
  expect(totalDuration).toBeLessThan(3000); // But not excessive
});
```

### Edge Case Testing

#### Zero and Negative Timeout Handling

```typescript
it('should handle zero timeout gracefully', async () => {
  const result = await session.click('#nonexistent', { timeout: 0 });

  // Zero timeout should either fail immediately or use a minimal timeout
  expect(result.success).toBe(false);
  expect(result.duration).toBeLessThan(1000); // Should fail quickly
});

it('should handle negative timeout gracefully', async () => {
  const result = await session.waitForElement('#nonexistent', { timeout: -100 });

  // Negative timeout should either fail immediately or be treated as zero/minimal
  expect(result.success).toBe(false);
  expect(result.duration).toBeLessThan(1000);
});
```

## Best Practices

### 1. Timeout Configuration

- **Use appropriate defaults**: Set reasonable default timeouts for different operation types
- **Allow overrides**: Provide timeout parameters for all blocking operations
- **Consider context**: Use longer timeouts for network operations, shorter for UI interactions
- **Document behavior**: Clearly specify timeout units (ms vs minutes) and default values

### 2. Error Handling

- **Descriptive messages**: Include operation type and timeout value in error messages
- **Preserve state**: Ensure timeout errors don't corrupt application state
- **Graceful degradation**: Continue execution when possible after timeout errors

### 3. Testing Strategy

- **Comprehensive coverage**: Test all timeout configurations and edge cases
- **Timing tolerance**: Account for timing variance in test assertions
- **Concurrent scenarios**: Test timeout behavior under concurrent operations
- **Performance validation**: Ensure timeouts don't significantly exceed expected duration

### 4. Implementation Patterns

- **Promise.race for timeouts**: Use Promise.race pattern for implementing custom timeouts
- **Cleanup on timeout**: Properly clean up resources when operations timeout
- **Inheritance hierarchy**: Implement logical timeout inheritance (global → session → operation)

## Troubleshooting

### Common Timeout Issues

#### 1. Timeouts Too Short

**Symptoms**: Operations failing consistently due to timeout
**Solutions**:
- Increase timeout values for specific operations
- Check network conditions and server response times
- Consider using exponential backoff for retries

#### 2. Timeouts Too Long

**Symptoms**: Applications hanging, poor user experience
**Solutions**:
- Reduce timeout values to reasonable levels
- Implement progress indicators for long operations
- Add cancellation mechanisms

#### 3. Inconsistent Timeout Behavior

**Symptoms**: Timeouts working sometimes but not others
**Solutions**:
- Check for race conditions in timeout implementation
- Ensure proper cleanup of timeout handlers
- Validate timeout inheritance chains

### Debugging Timeout Issues

#### 1. Enable Debug Logging

```typescript
// Add timing information to logs
const startTime = Date.now();
try {
  const result = await operation();
  console.log(`Operation completed in ${Date.now() - startTime}ms`);
  return result;
} catch (error) {
  console.log(`Operation failed after ${Date.now() - startTime}ms:`, error.message);
  throw error;
}
```

#### 2. Monitor Timeout Patterns

```typescript
// Track timeout statistics
class TimeoutMonitor {
  private timeouts: Map<string, number[]> = new Map();

  recordTimeout(operation: string, duration: number, success: boolean) {
    if (!this.timeouts.has(operation)) {
      this.timeouts.set(operation, []);
    }
    this.timeouts.get(operation)!.push(duration);
  }

  getStats(operation: string) {
    const durations = this.timeouts.get(operation) || [];
    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }
}
```

### Performance Optimization

#### 1. Adaptive Timeouts

Consider implementing adaptive timeouts based on historical performance:

```typescript
class AdaptiveTimeout {
  private history: Map<string, number[]> = new Map();

  getTimeout(operation: string, defaultTimeout: number): number {
    const history = this.history.get(operation) || [];
    if (history.length < 5) return defaultTimeout;

    const average = history.reduce((a, b) => a + b, 0) / history.length;
    return Math.max(defaultTimeout, average * 1.5); // 50% buffer
  }

  recordDuration(operation: string, duration: number) {
    if (!this.history.has(operation)) {
      this.history.set(operation, []);
    }
    const history = this.history.get(operation)!;
    history.push(duration);

    // Keep only recent history (last 10 operations)
    if (history.length > 10) {
      history.shift();
    }
  }
}
```

#### 2. Timeout Hierarchies

Implement timeout inheritance for cleaner configuration:

```typescript
class TimeoutManager {
  constructor(
    private globalTimeout: number,
    private sessionTimeout?: number,
    private operationTimeouts: Map<string, number> = new Map()
  ) {}

  getTimeout(operation: string, override?: number): number {
    // Priority: override > operation-specific > session > global
    return override ??
           this.operationTimeouts.get(operation) ??
           this.sessionTimeout ??
           this.globalTimeout;
  }
}
```

This comprehensive documentation covers all aspects of timeout configurations and wait strategies in the APEX codebase, providing developers with the knowledge needed to effectively implement, test, and troubleshoot timeout-related functionality.